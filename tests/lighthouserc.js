/*
 * Lighthouse CI config for this POC.
 *
 * Run with: npm run test:lighthouse
 * (which sets NODE_ENV=production so `npm run start` serves PRODUCTION bundles
 *  — dev bundles are unminified and would give misleading scores).
 *
 * URLs are bare (`/category/...`, `/product/...`) because config/default.js sets
 * url.site:'none' and url.locale:'none' for the single RefArch / en-US site.
 * Results are written locally to ./.lighthouseci (gitignored) instead of being
 * uploaded to Google's temporary public storage.
 */
module.exports = {
    ci: {
        collect: {
            startServerCommand: 'npm run start',
            url: [
                'http://localhost:3000/',
                'http://localhost:3000/category/womens',
                'http://localhost:3000/product/25493587M',
                'http://localhost:3000/search?q=dress'
            ],
            // pwa-kit-dev prints this once the production webpack build is served.
            startServerReadyPattern: 'First build complete',
            startServerReadyTimeout: 180000,
            // 1 run keeps the POC fast; bump to 3 (median) for lower-noise numbers.
            numberOfRuns: 1
        },
        upload: {
            target: 'filesystem',
            outputDir: './.lighthouseci',
            reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%.report.%%EXTENSION%%'
        }
    }
}
