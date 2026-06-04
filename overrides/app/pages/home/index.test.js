/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React from 'react'
// Co-located override test: import the subject relatively. The jest-resolver
// resolves same-directory alias imports to base, so an alias here would load
// the base home page rather than this override.
import Home from './index'
import {renderWithProviders} from '@salesforce/retail-react-app/app/utils/test-utils'
import {screen, waitFor, within} from '@testing-library/react'
import {rest} from 'msw'
import {mockProductSearch, mockCategories} from '@salesforce/retail-react-app/app/mocks/mock-data'

jest.mock('@salesforce/retail-react-app/app/components/image/utils', () => ({
    ...jest.requireActual('@salesforce/retail-react-app/app/components/image/utils'),
    isServer: jest.fn().mockReturnValue(true)
}))

const mockSendViewPage = jest.fn()
jest.mock('@salesforce/retail-react-app/app/hooks/use-einstein', () => ({
    __esModule: true,
    default: () => ({
        sendViewPage: mockSendViewPage,
        sendViewProduct: jest.fn(),
        sendViewSearch: jest.fn()
    })
}))

const setupHandlers = () => {
    global.server.use(
        rest.get('*/product-search', (req, res, ctx) =>
            res(ctx.delay(0), ctx.status(200), ctx.json(mockProductSearch))
        ),
        rest.get('*/categories/:categoryId', (req, res, ctx) =>
            res(ctx.delay(0), ctx.status(200), ctx.json(mockCategories.root))
        )
    )
}

describe('given the storefront home page', () => {
    beforeEach(() => {
        mockSendViewPage.mockClear()
        setupHandlers()
    })

    describe('when the page is rendered', () => {
        test('then it renders the home page shell and hero call to action', async () => {
            renderWithProviders(<Home />)

            expect(await screen.findByTestId('home-page')).toBeInTheDocument()

            const shopNewArrivals = await screen.findByRole('link', {name: /shop new arrivals/i})
            expect(shopNewArrivals).toHaveAttribute(
                'href',
                expect.stringContaining('/category/newarrivals')
            )
        })

        test('then it exposes a stable template name', () => {
            expect(Home.getTemplateName()).toBe('home')
        })

        test('then it reports the page view to Einstein', async () => {
            renderWithProviders(<Home />)

            await waitFor(() => expect(mockSendViewPage).toHaveBeenCalled())
        })
    })

    describe('when the value-proposition strip is rendered', () => {
        test('then it shows the trust badges a real store leads with', async () => {
            renderWithProviders(<Home />)

            expect(await screen.findByText(/free shipping over \$50/i)).toBeInTheDocument()
            expect(screen.getByText(/easy 30-day returns/i)).toBeInTheDocument()
            expect(screen.getByText(/secure checkout/i)).toBeInTheDocument()
        })
    })

    describe('when root categories are available', () => {
        test('then each category tile links to its product listing page', async () => {
            renderWithProviders(<Home />)

            const heading = await screen.findByRole('heading', {name: /shop by category/i})
            expect(heading).toBeInTheDocument()

            const [{id, name}] = mockCategories.root.categories
            const tile = await screen.findByRole('link', {name})
            expect(tile).toHaveAttribute('href', expect.stringContaining(`/category/${id}`))
        })
    })

    describe('when the promotional banner is rendered', () => {
        test('then the call to action routes to registration', async () => {
            renderWithProviders(<Home />)

            const createAccount = await screen.findByRole('link', {name: /create account/i})
            expect(createAccount).toHaveAttribute('href', expect.stringContaining('/registration'))
        })
    })

    describe('when catalog products are returned', () => {
        test('then the new arrivals section is shown', async () => {
            renderWithProviders(<Home />)

            const newArrivals = await screen.findByRole('heading', {name: /new arrivals/i})
            const scroller = within(newArrivals.closest('section')).getByTestId('product-scroller')
            expect(scroller).toBeInTheDocument()
        })
    })
})
