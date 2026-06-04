/*
 * Standalone HTTP server for self-hosting the PWA Kit production build
 * (e.g. on Railway, Render, Fly, or any container host).
 *
 * PWA Kit targets Salesforce Managed Runtime (AWS Lambda) and ships no
 * long-lived server: `build/ssr.js` exports `get`, an API-Gateway Lambda
 * handler. The runtime's createHandler() also returns the underlying Express
 * `app` (re-exported from overrides/app/ssr.js), which serves the built bundle
 * from build/ — but ONLY when the runtime is in "remote" (production) mode.
 *
 * `isRemote()` in @salesforce/pwa-kit-runtime is simply:
 *     () => 'AWS_LAMBDA_FUNCTION_NAME' in process.env
 * so we set that (and the other Managed-Runtime env vars the server reads) here,
 * BEFORE requiring the built bundle, then mount the PWA Kit app behind a thin
 * Express parent that supplies the two things Managed Runtime normally provides
 * but a bare container does not: a per-request correlation id (API Gateway) and
 * static serving of the bundle assets (the CDN).
 */
'use strict'

const path = require('path')
const {randomUUID} = require('crypto')
const express = require('express')
const {createProxyMiddleware, fixRequestBody} = require('http-proxy-middleware')

// React must render in production mode. The build itself is always compiled
// with NODE_ENV=production by pwa-kit-dev; this covers the runtime render.
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

// Put the PWA Kit runtime into "remote" mode so it serves the built bundle
// under /mobify/bundle/$BUNDLE_ID/ instead of an on-the-fly dev bundle.
// These are read at module-evaluation time, so they must be set before the
// require() of build/ssr.js below. In remote mode the runtime also asserts
// BUNDLE_ID, DEPLOY_TARGET, EXTERNAL_DOMAIN_NAME and MOBIFY_PROPERTY_ID exist.
process.env.AWS_LAMBDA_FUNCTION_NAME =
    process.env.AWS_LAMBDA_FUNCTION_NAME || 'maris-pwa-storefront'
process.env.BUNDLE_ID = process.env.BUNDLE_ID || 'production'
process.env.DEPLOY_TARGET = process.env.DEPLOY_TARGET || 'production'
process.env.MOBIFY_PROPERTY_ID = process.env.MOBIFY_PROPERTY_ID || 'maris-pwa-storefront'

// EXTERNAL_DOMAIN_NAME drives the server's canonical host/origin (used for
// absolute URLs, the self-proxy host header, and SLAS redirect URIs). Railway
// exposes the public domain as RAILWAY_PUBLIC_DOMAIN; fall back to localhost so
// the same file runs locally for verification.
const port = process.env.PORT || 3000
process.env.EXTERNAL_DOMAIN_NAME =
    process.env.EXTERNAL_DOMAIN_NAME || process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:${port}`

// Require AFTER the env is configured. build/ssr.js is compiled as a CommonJS
// module (webpack libraryTarget: commonjs2), so its ESM `export {app}` surfaces
// here as `.app`.
const buildDir = process.env.PWA_KIT_BUILD_DIR || path.resolve(__dirname, 'build')
const {app} = require(path.join(buildDir, 'ssr.js'))

if (!app || typeof app.use !== 'function') {
    throw new Error(
        'build/ssr.js did not export an Express `app`. Run `npm run build` and ' +
            'ensure overrides/app/ssr.js exports the app from createHandler().'
    )
}

const root = express()

// (1) Correlation id. PWA Kit's _setRequestId middleware (which runs before any
// app middleware) derives res.locals.requestId from the `x-correlation-id`
// header, or the `x-apigateway-event` header that API Gateway injects on Managed
// Runtime. A direct HTTP request has neither, leaving requestId undefined — which
// then crashes CorrelationIdProvider during SSR (`_correlationIdFn is not a
// function`). This parent middleware runs before the mounted PWA Kit app, so it
// sets the header in time.
root.use((req, _res, next) => {
    if (!req.headers['x-correlation-id']) {
        req.headers['x-correlation-id'] = randomUUID()
    }
    next()
})

// (2) Serve the built bundle. In remote mode PWA Kit's _addStaticAssetServing is
// a no-op ("Handled by the CDN on remote"). Self-hosting has no CDN, so we serve
// /mobify/bundle/$BUNDLE_ID/* (JS chunks, static assets, compiled translations)
// straight from build/. Hashed bundle filenames are safe to cache immutably.
//
// build/ also contains server-only files (the SSR/renderer bundles, the copied
// config/ and package.json). On Managed Runtime these are `ssrOnly` and the CDN
// never exposes them; the client never requests them either. Deny them here so
// self-hosting doesn't publish server source/config over HTTP.
const denyFromBundle =
    /^(ssr|server-renderer|request-processor|loader)\.js(\.map)?$|^package\.json$|^config\//
root.use(`/mobify/bundle/${process.env.BUNDLE_ID}`, (req, res, next) => {
    const relativePath = req.path.replace(/^\/+/, '')
    if (denyFromBundle.test(relativePath)) {
        res.status(404).end()
        return
    }
    next()
})
root.use(
    `/mobify/bundle/${process.env.BUNDLE_ID}`,
    express.static(buildDir, {immutable: true, maxAge: '365d', fallthrough: true})
)

// (2.5) Proxy /mobify/proxy/<name>/* to the configured commerce backends. In
// remote mode PWA Kit's _setupProxying is a hardcoded 501 stub, because on
// Managed Runtime the eCDN proxies these paths upstream of the Lambda. Self-
// hosting has no eCDN, so without this every SCAPI call — including the guest
// SLAS token exchange that gates all shopper data — returns 501 and pages render
// without products. We read the same proxyConfigs the app uses and stand up a
// real proxy per entry, mounted before the app so it wins over the 501 stub.
//
//
// SLAS redirect_uri rewrite: the shared demo SLAS client only accepts
// redirect_uris on its registered allow-list, which does not include this host
// and can't be changed without Account Manager access. Both the guest authorize
// AND the token exchange reject our public callback with 400. So we translate at
// the proxy: swap our public callback for a registered one on every request
// heading to SLAS (authorize query string + token request body), and swap it
// back in the 303 Location so the browser only ever follows the redirect to our
// own origin. PKCE (code_verifier/challenge) is independent of redirect_uri, so
// the exchange still succeeds and the guest token is normal.
const PUBLIC_CALLBACK = `https://${process.env.EXTERNAL_DOMAIN_NAME}/callback`
const REGISTERED_CALLBACK = process.env.SLAS_REGISTERED_CALLBACK || 'http://localhost:3000/callback'
const encPublic = encodeURIComponent(PUBLIC_CALLBACK)
const encRegistered = encodeURIComponent(REGISTERED_CALLBACK)
// Parse the SLAS token POST body so its redirect_uri can be rewritten. Scoped to
// the token endpoint so no other proxied request has its stream touched.
const tokenBodyParser = express.urlencoded({extended: false})

// Empty-response shim for SCAPI features the shared demo guest token isn't
// scoped for. Shopper Context and Shopper Configurations both 403 on this
// backend, and each is queried from several base components (the app shell,
// page-designer banner, marketing-consent footer form, sf-payments check) — so
// rather than override every caller, we answer the two GETs at the proxy.
//
// Shopper Context returns `null` (not `{}`) on purpose: consumers gate dependent
// requests on its truthiness — e.g. the PLP Page Designer banner only fetches
// its promo pages when `!!shopperContext`. A truthy `{}` would switch those on
// and surface a fresh 403 on the (also-unavailable) shopper-experience pages
// API; `null` keeps shopper context "absent" — matching reality — so those
// queries stay disabled, as they were when the call 403'd, but without the
// console error. Shopper Configurations returns an empty list, so the
// feature-flag lookups it backs (sf-payments, marketing consent) resolve to off.
// Remove this once the SLAS client carries the shopper-context /
// shopper-experience scopes.
const isShimmedScapiGet = (method, reqPath) =>
    method === 'GET' &&
    (/\/shopper-context\/v1\/.+\/shopper-context\//.test(reqPath) ||
        /\/shopper-configurations\/v1\/.+\/configurations$/.test(reqPath))
const shimEmptyScapi = (req, res, next) => {
    if (!isShimmedScapiGet(req.method, req.path)) return next()
    res.set('cache-control', 'no-store')
    return req.path.includes('/shopper-configurations/')
        ? res.status(200).json({limit: 0, data: [], total: 0})
        : res.status(200).json(null)
}

const {ssrParameters} = require(path.join(__dirname, 'config', 'default.js'))
for (const {host, path: proxyName} of ssrParameters.proxyConfigs || []) {
    const mountPath = `/mobify/proxy/${proxyName}`
    root.use(mountPath, shimEmptyScapi)
    root.use(mountPath, (req, res, next) =>
        req.method === 'POST' && req.path.includes('/oauth2/token')
            ? tokenBodyParser(req, res, next)
            : next()
    )
    root.use(
        mountPath,
        createProxyMiddleware({
            target: `https://${host}`,
            changeOrigin: true,
            secure: true,
            xfwd: false,
            // Strip the /mobify/proxy/<name> prefix so SCAPI/OCAPI sees the bare
            // resource path. The regex is a no-op if the mount already stripped
            // it, so this is correct whether the proxy reads the original or the
            // mount-relative URL.
            pathRewrite: {[`^${mountPath}`]: ''},
            onProxyReq: (proxyReq, req) => {
                // authorize: redirect_uri lives in the (encoded) query string
                if (proxyReq.path.includes(encPublic)) {
                    proxyReq.path = proxyReq.path.split(encPublic).join(encRegistered)
                }
                // token: redirect_uri lives in the parsed urlencoded body
                if (req.body && req.body.redirect_uri === PUBLIC_CALLBACK) {
                    req.body.redirect_uri = REGISTERED_CALLBACK
                    fixRequestBody(proxyReq, req)
                }
            },
            onProxyRes: (proxyRes) => {
                // swap the registered callback back to ours in the 303 Location
                // so the browser follows the redirect to our own /callback
                const location = proxyRes.headers.location
                if (location && location.includes(REGISTERED_CALLBACK)) {
                    proxyRes.headers.location = location
                        .split(REGISTERED_CALLBACK)
                        .join(PUBLIC_CALLBACK)
                }
            }
        })
    )
}

// (3) The PWA Kit app handles everything else: SSR rendering, the SLAS callbacks,
// and the /mobify/ping healthcheck.
root.use(app)

root.listen(port, () => {
    console.log(
        `PWA Kit production server listening on :${port} ` +
            `(host ${process.env.EXTERNAL_DOMAIN_NAME}, bundle ${process.env.BUNDLE_ID})`
    )
})
