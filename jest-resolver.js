/*
 * Copyright (c) 2024, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Jest resolver for the PWA Kit "extends" model.
 *
 * At runtime/build the webpack `overrides-plugin` rewrites imports of the
 * extended package (e.g. `@salesforce/retail-react-app/app/...`) to the
 * matching file under `overridesDir` when one exists. That plugin is not active
 * under jest, so without this resolver:
 *   - a test importing an overridden module via the alias would load the BASE
 *     file instead of the override, and
 *   - a module under test that transitively imports an overridden component
 *     would silently exercise the base component, not the override.
 *
 * This resolver reproduces the override-then-base lookup so jest resolution
 * matches production. Imports that don't target an extended package, or that
 * have no override on disk, fall through to jest's default resolver.
 *
 * Self-reference guard: an override file commonly re-exports the base it
 * extends, e.g. `overrides/app/constants.js` does
 * `export * from '@salesforce/retail-react-app/app/constants'`. Redirecting
 * that import back to the override would be circular, so when the override
 * candidate lives in the SAME directory as the importing module we resolve to
 * base instead. (Co-located override tests therefore import their subject via a
 * relative path; cross-directory imports — base→override and override→other
 * override — resolve to the override as in production.)
 */
/* eslint @typescript-eslint/no-var-requires: "off" */
const fs = require('fs')
const path = require('path')

const pkg = require('./package.json')

const {extends: extendsConfig, overridesDir = ''} = pkg.ccExtensibility || {}
const extendsPkgs = (Array.isArray(extendsConfig) ? extendsConfig : [extendsConfig]).filter(Boolean)
const overridesRoot = path.join(__dirname, overridesDir.replace(/^[/\\]/, ''))
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx']

const firstExisting = (candidates) =>
    candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())

/**
 * Given a sub-path relative to the override root (e.g. `app/components/x`),
 * return the absolute path of the override file if one exists, else null.
 */
const resolveOverride = (subPath) => {
    const base = path.join(overridesRoot, subPath)
    const fileMatch = firstExisting([base, ...EXTENSIONS.map((ext) => base + ext)])
    if (fileMatch) {
        return fileMatch
    }
    return firstExisting(EXTENSIONS.map((ext) => path.join(base, `index${ext}`))) || null
}

module.exports = (request, options) => {
    for (const pkgName of extendsPkgs) {
        const prefix = `${pkgName}/`
        if (request.startsWith(prefix)) {
            const subPath = request.slice(prefix.length)
            // Only `app/**` is overridable in the extends model.
            if (subPath.startsWith('app/')) {
                const override = resolveOverride(subPath)
                if (override && path.dirname(override) !== path.resolve(options.basedir || '')) {
                    return override
                }
            }
        }
    }
    return options.defaultResolver(request, options)
}
