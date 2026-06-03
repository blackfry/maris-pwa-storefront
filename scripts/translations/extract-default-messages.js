#!/usr/bin/env node
/*
 * Copyright (c) 2024, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint @typescript-eslint/no-var-requires: "off" */

/**
 * Extract default i18n messages for the extends-model storefront.
 *
 * This replaces the base @salesforce/retail-react-app extract script, which
 * excludes every base file that has an override and scans the override instead.
 * That behaviour silently drops messages whenever an override is a re-export
 * shim or a partial reimplementation — e.g. `overrides/app/constants.js` does
 * `export * from '@salesforce/retail-react-app/app/constants'` and declares no
 * messages of its own, so all the base constants messages (API errors, toasts,
 * etc.) disappeared from the catalog.
 *
 * Instead we scan BOTH the base app and the overrides, listing the override
 * globs LAST. formatjs extraction is last-wins for duplicate ids, so an
 * override that reimplements a message wins, while base-only messages are
 * preserved. Unused base messages left behind by a full reimplementation are
 * harmless (an extra catalog entry) and far preferable to dropping in-use ones.
 */
const {exec} = require('child_process')
const fs = require('fs')
const path = require('path')

const packagePath = path.join(process.cwd(), 'package.json')
const pkgJSON = JSON.parse(fs.readFileSync(packagePath))

function buildCommand(locale) {
    const {extends: extendsConfig, overridesDir} = pkgJSON.ccExtensibility || {}
    const common = [
        `--out-file translations/${locale}.json`,
        '--id-interpolation-pattern [sha512:contenthash:base64:6]'
    ]

    if (!overridesDir) {
        return ['formatjs extract "app/**/*.{js,jsx,ts,tsx}"', ...common].join(' ')
    }

    const extendsPkgs = (Array.isArray(extendsConfig) ? extendsConfig : [extendsConfig]).filter(
        Boolean
    )
    const overridesGlob = `"${overridesDir.replace(/^[/\\]/, '')}/app/**/*.{js,jsx,ts,tsx}"`
    // Base globs first, override glob last (last-wins on duplicate ids).
    const baseGlobs = extendsPkgs.map(
        (pkgName) => `"./node_modules/${pkgName}/app/**/*.{js,jsx,ts,tsx}"`
    )

    return ['formatjs extract', ...baseGlobs, overridesGlob, ...common].join(' ')
}

function extract(locale) {
    exec(buildCommand(locale), (err) => {
        if (err) {
            console.error(err)
            process.exitCode = 1
        }
    })
}

try {
    // example usage: node ./scripts/translations/extract-default-messages.js en-US en-GB
    process.argv.slice(2).forEach(extract)
} catch (error) {
    console.error(error)
    process.exitCode = 1
}
