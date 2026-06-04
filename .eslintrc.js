/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

module.exports = {
    extends: [require.resolve('@salesforce/pwa-kit-dev/configs/eslint')],
    overrides: [
        {
            // Root-level CommonJS build/config files that the toolchain loads
            // with require() (not bundled app code) — `require()` is correct here.
            files: ['webpack.config.js'],
            env: {node: true},
            rules: {
                '@typescript-eslint/no-var-requires': 'off'
            }
        }
    ]
}
