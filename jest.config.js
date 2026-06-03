/*
 * Copyright (c) 2024, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const base = require('@salesforce/pwa-kit-dev/configs/jest/jest.config.js')

module.exports = {
    ...base,
    // Mirror the webpack overrides-plugin under jest so imports of the extended
    // package resolve to files in `overrides/` when present, exactly like
    // production. Without this, tests would load base files instead of overrides.
    resolver: '<rootDir>/jest-resolver.js',
    // Reuse the retail-react-app test bootstrap: it registers @testing-library/jest-dom
    // matchers, starts the msw mock SCAPI server, and installs the jsdom storage/crypto
    // mocks that renderWithProviders relies on.
    setupFilesAfterEnv: ['<rootDir>/node_modules/@salesforce/retail-react-app/jest-setup.js'],
    // To support extensibility, jest needs to transform the underlying templates/extensions.
    // The retail-react-app base also depends on a handful of packages that ship as ESM
    // (cc-datacloud-typescript, storefront-next-runtime); these must be transformed too,
    // otherwise any test that imports the shared test-utils fails to parse them.
    transformIgnorePatterns: [
        '/node_modules/(?!@salesforce/retail-react-app/.*|@salesforce/cc-datacloud-typescript|@salesforce/storefront-next-runtime)'
    ],
    moduleNameMapper: {
        ...base.moduleNameMapper,
        // pulled from @salesforce/retail-react-app jest.config.js
        // allows jest to resolve imports for these packages
        '^is-what$': '<rootDir>/node_modules/is-what/dist/cjs/index.cjs',
        '^copy-anything$': '<rootDir>/node_modules/copy-anything/dist/cjs/index.cjs',
        '^@salesforce/cc-datacloud-typescript$':
            '<rootDir>/node_modules/@salesforce/cc-datacloud-typescript/dist/index.js',
        '^@salesforce/storefront-next-runtime/design/react/core$':
            '<rootDir>/node_modules/@salesforce/storefront-next-runtime/dist/design-react-core.js',
        '^@salesforce/storefront-next-runtime/design/react$':
            '<rootDir>/node_modules/@salesforce/storefront-next-runtime/dist/design-react.js',
        '^@salesforce/storefront-next-runtime/design$':
            '<rootDir>/node_modules/@salesforce/storefront-next-runtime/dist/design.js',
        '^@salesforce/storefront-next-runtime/design/mode$':
            '<rootDir>/node_modules/@salesforce/storefront-next-runtime/dist/design-mode.js',
        '^@salesforce/storefront-next-runtime/scapi$':
            '<rootDir>/node_modules/@salesforce/storefront-next-runtime/dist/scapi.js',
        '^@salesforce/storefront-next-runtime/design/styles\\.css$':
            '<rootDir>/node_modules/@salesforce/retail-react-app/app/mocks/empty-mock.js'
    }
}
