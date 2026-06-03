/*
 * Copyright (c) 2024, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint @typescript-eslint/no-var-requires: "off" */
const path = require('path')
const resolver = require('./jest-resolver')

const PKG = '@salesforce/retail-react-app'
const ROOT = __dirname
const overridesPath = (rel) => path.join(ROOT, 'overrides', rel)
const baseDir = (rel) => path.join(ROOT, 'node_modules', PKG, rel)

const SENTINEL = '__default_resolver__'
const makeOptions = (basedir) => ({
    basedir,
    defaultResolver: jest.fn(() => SENTINEL)
})

describe('given the extends-model jest resolver', () => {
    describe('when a base file imports an overridden module via the alias', () => {
        test('then it resolves to the override file', () => {
            const options = makeOptions(baseDir('app/pages/product-list'))
            const resolved = resolver(`${PKG}/app/components/product-tile/index`, options)
            expect(resolved).toBe(overridesPath('app/components/product-tile/index.jsx'))
            expect(options.defaultResolver).not.toHaveBeenCalled()
        })

        test('then a directory specifier resolves to the override index file', () => {
            const options = makeOptions(baseDir('app/components/recommended-products'))
            const resolved = resolver(`${PKG}/app/components/product-tile`, options)
            expect(resolved).toBe(overridesPath('app/components/product-tile/index.jsx'))
        })
    })

    describe('when an override re-exports its own base (same directory)', () => {
        test('then it falls through to base to avoid a circular import', () => {
            // overrides/app/constants.js does `export * from '<pkg>/app/constants'`
            const options = makeOptions(overridesPath('app'))
            const resolved = resolver(`${PKG}/app/constants`, options)
            expect(resolved).toBe(SENTINEL)
            expect(options.defaultResolver).toHaveBeenCalled()
        })
    })

    describe('when the import targets the extends package but has no override', () => {
        test('then it falls through to the default resolver', () => {
            const options = makeOptions(baseDir('app/pages/home'))
            const resolved = resolver(`${PKG}/app/components/header`, options)
            expect(resolved).toBe(SENTINEL)
        })
    })

    describe('when the import is not part of the extends package', () => {
        test('then it falls through to the default resolver', () => {
            const options = makeOptions(baseDir('app/pages/home'))
            expect(resolver('react', options)).toBe(SENTINEL)
            expect(resolver('@salesforce/commerce-sdk-react', options)).toBe(SENTINEL)
        })
    })
})
