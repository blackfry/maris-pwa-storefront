/*
 * Project webpack config (Template Extensibility seam).
 *
 * pwa-kit-dev's `build` command uses a project-root `webpack.config.js` if one
 * exists, otherwise it falls back to its own default
 * (`@salesforce/pwa-kit-dev/configs/webpack/config.js`). See
 * node_modules/@salesforce/pwa-kit-dev/bin/pwa-kit-dev.js (the `build` action).
 *
 * We require that default array of configs and surgically rewrite ONLY the
 * browser-facing `client` config's chunk-splitting. Everything else (loaders,
 * SSR/renderer/request-processor configs, plugins, the @loadable webpack plugin
 * that writes build/loadable-stats.json) is inherited untouched.
 *
 * Why: the stock config puts EVERY node_modules dependency into a single,
 * eagerly-loaded `vendor.js` via one `chunks: 'all'` cacheGroup with a fixed
 * name. Because pages are code-split with loadable() but their dependencies are
 * not, the home page downloads libraries it never runs — e.g.
 * `@vis.gl/react-google-maps` (checkout + store-locator only) and
 * `react-hook-form` (checkout/account forms only). That is exactly the "unused
 * JavaScript" Lighthouse reports on initial load.
 */
const baseConfigs = require('@salesforce/pwa-kit-dev/configs/webpack/config.js')

// The browser bundle. This is the only config that emits vendor.js.
const client = baseConfigs.find((config) => config && config.name === 'client')

// Reuse pwa-kit's own extensibility-aware "is this a vendor module?" test
// rather than re-deriving it. It already encodes the rule that an extended
// template's baseline route files must NOT land in vendor.js, so staying in
// lock-step with it avoids drift if the base build changes that logic. Guard
// the full path: if a future base version restructures splitChunks we leave the
// stock config untouched rather than installing a `test: undefined` cacheGroup
// (which would match every module).
const isVendorModule =
    client &&
    client.optimization &&
    client.optimization.splitChunks &&
    client.optimization.splitChunks.cacheGroups &&
    client.optimization.splitChunks.cacheGroups.vendor &&
    client.optimization.splitChunks.cacheGroups.vendor.test

if (isVendorModule) {
    client.optimization = {
        ...client.optimization,
        splitChunks: {
            // Consider every chunk when deciding what to split, but let each
            // cacheGroup below scope itself to initial vs async graphs.
            chunks: 'all',
            // Cut 2: stop shipping one monolithic vendor.js. Split vendor into a
            // handful of parallel-fetchable, independently-cacheable pieces so a
            // change to one library no longer busts the cache for all of them.
            // minSize keeps us from over-fragmenting into many tiny chunks (each
            // a separate request); maxSize bounds the upper end. Single modules
            // larger than maxSize (e.g. commerce-sdk-isomorphic's pre-bundled
            // ~485 KiB ESM file) can't be split further and stay whole. SSR
            // injects the right <script> tags per route from loadable-stats.json,
            // so multi-file vendor output is transparent to the server renderer.
            minSize: 100 * 1024,
            maxSize: 350 * 1024,
            // Allow webpack to actually emit the extra pieces.
            maxInitialRequests: 15,
            maxAsyncRequests: 15,
            cacheGroups: {
                // Cut 1a: the EAGER vendor chunk now only holds node_modules
                // that are in the INITIAL load graph (React, Chakra/Emotion,
                // commerce-sdk-react, react-query, react-intl, router — the
                // providers wired up in _app-config). Libraries reached only
                // through a loadable() route are no longer hoisted here.
                vendor: {
                    test: isVendorModule,
                    name: 'vendor',
                    chunks: 'initial',
                    priority: 20,
                    reuseExistingChunk: true
                },
                // Cut 1b: vendor code shared by two or more lazy routes is
                // extracted into a single shared async chunk (loaded alongside
                // the first such route) instead of being duplicated into each
                // route's chunk. Async deps used by only one route simply stay
                // in that route's own chunk.
                vendorAsync: {
                    test: isVendorModule,
                    name: 'vendor-async',
                    chunks: 'async',
                    minChunks: 2,
                    priority: 10,
                    reuseExistingChunk: true
                }
            }
        }
    }
}

module.exports = baseConfigs
