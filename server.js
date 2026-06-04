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

// (3) The PWA Kit app handles everything else: SSR rendering, the SCAPI proxy
// (/mobify/proxy/api), the SLAS callbacks, and the /mobify/ping healthcheck.
root.use(app)

root.listen(port, () => {
    console.log(
        `PWA Kit production server listening on :${port} ` +
            `(host ${process.env.EXTERNAL_DOMAIN_NAME}, bundle ${process.env.BUNDLE_ID})`
    )
})
