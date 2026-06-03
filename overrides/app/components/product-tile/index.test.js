/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React from 'react'
// Co-located override test: import the subject relatively. The jest-resolver
// intentionally resolves same-directory alias imports to base (to keep
// re-export shims like constants.js from looping), so the alias here would load
// the base tile, not this override.
import ProductTile, {Skeleton} from './index'
import {renderWithProviders} from '@salesforce/retail-react-app/app/utils/test-utils'
import {fireEvent, waitFor, within, screen} from '@testing-library/react'
import {
    mockMasterProductHitWithMultipleVariants,
    mockMasterProductHitWithOneVariant,
    mockProductSearchItem,
    mockProductSetHit,
    mockStandardProductHit
} from '@salesforce/retail-react-app/app/mocks/product-search-hit-data'
import {useBreakpointValue} from '@salesforce/retail-react-app/app/components/shared/ui'

const mockAddItemToNewOrExistingBasket = jest.fn()
const mockShowToast = jest.fn()
const mockNavigate = jest.fn()
const mockSendAddToCart = jest.fn()

jest.mock('@salesforce/retail-react-app/app/components/shared/ui', () => {
    const originalModule = jest.requireActual(
        '@salesforce/retail-react-app/app/components/shared/ui'
    )
    return {
        ...originalModule,
        useBreakpointValue: jest.fn()
    }
})

jest.mock('@salesforce/commerce-sdk-react', () => {
    const actual = jest.requireActual('@salesforce/commerce-sdk-react')
    return {
        ...actual,
        useShopperBasketsV2MutationHelper: () => ({
            addItemToNewOrExistingBasket: mockAddItemToNewOrExistingBasket
        })
    }
})

jest.mock('@salesforce/retail-react-app/app/hooks/use-toast', () => ({
    useToast: () => mockShowToast
}))

jest.mock('@salesforce/retail-react-app/app/hooks/use-navigation', () => ({
    __esModule: true,
    default: () => mockNavigate
}))

jest.mock('@salesforce/retail-react-app/app/hooks/use-einstein', () => ({
    __esModule: true,
    default: () => ({
        sendAddToCart: mockSendAddToCart
    })
}))

beforeEach(() => {
    mockAddItemToNewOrExistingBasket.mockReset()
    mockAddItemToNewOrExistingBasket.mockResolvedValue({})
    mockShowToast.mockReset()
    mockNavigate.mockReset()
    mockSendAddToCart.mockReset()
})

test('Renders links and images', () => {
    const {getAllByRole} = renderWithProviders(<ProductTile product={mockProductSearchItem} />)

    const link = getAllByRole('link')
    const img = getAllByRole('img')

    expect(link).toBeDefined()
    expect(img).toBeDefined()
})

test('Renders Skeleton', () => {
    const {getAllByTestId} = renderWithProviders(<Skeleton />)

    const skeleton = getAllByTestId('sf-product-tile-skeleton')

    expect(skeleton).toBeDefined()
})

test('Renders PricingAndPromotionsSkeleton when isRefetching is true', async () => {
    const {getAllByTestId, queryByTestId} = renderWithProviders(
        <ProductTile isRefreshingData={true} product={mockMasterProductHitWithMultipleVariants} />
    )

    const skeleton = getAllByTestId('sf-product-tile-pricing-and-promotions-skeleton')

    expect(skeleton).toBeDefined()
    expect(queryByTestId('sf-product-tile-skeleton')).not.toBeInTheDocument()
})

test('Remove from wishlist cannot be muti-clicked', () => {
    const onClick = jest.fn()

    const {getByTestId} = renderWithProviders(
        <ProductTile
            product={mockProductSearchItem}
            enableFavourite={true}
            onFavouriteToggle={onClick}
        />
    )
    const wishlistButton = getByTestId('wishlist-button')

    fireEvent.click(wishlistButton)
    fireEvent.click(wishlistButton)
    expect(onClick).toHaveBeenCalledTimes(1)
})

test('Renders variant details based on the selected swatch', async () => {
    useBreakpointValue.mockReturnValue(true)

    const {getAllByRole, getByTestId} = renderWithProviders(
        <ProductTile product={mockProductSearchItem} />
    )
    const swatches = getAllByRole('radio')
    const productImage = getByTestId('product-tile-image')
    const productTile = getByTestId('product-tile')

    // Initial render will show swatched and the image will be the represented product variation
    expect(swatches).toHaveLength(2)
    expect(productImage.firstChild.getAttribute('src')).toBe(
        'https://edge.disstg.commercecloud.salesforce.com/dw/image/v2/ZZRF_001/on/demandware.static/-/Sites-apparel-m-catalog/default/dw23283a20/images/medium/PG.33698RUBN4Q.CHARCWL.PZ.jpg'
    )
    const currentPriceTag = productTile.querySelectorAll('b')
    const strikethroughPriceTag = productTile.querySelectorAll('s')
    expect(currentPriceTag).toHaveLength(1)
    expect(within(currentPriceTag[0]).getByText(/£191\.99/i)).toBeDefined()
    expect(strikethroughPriceTag).toHaveLength(1)
    expect(within(strikethroughPriceTag[0]).getByText(/£320\.00/i)).toBeDefined()

    // Navigating to different color swatch changes the image & price.
    // Default selected swatch is swatches[1] as it is the represented product.
    fireEvent.mouseOver(swatches[0])
    await waitFor(() => screen.getByTestId('product-tile-image'))
    expect(productImage.firstChild.getAttribute('src')).toBe(
        'https://edge.disstg.commercecloud.salesforce.com/dw/image/v2/ZZRF_001/on/demandware.static/-/Sites-apparel-m-catalog/default/dwed78c6fc/images/medium/PG.52002RUBN4Q.NAVYWL.PZ.jpg'
    )
    expect(currentPriceTag).toHaveLength(1)
    expect(within(currentPriceTag[0]).getByText(/£143\.99/i)).toBeDefined()
    expect(strikethroughPriceTag).toHaveLength(1)
    expect(within(strikethroughPriceTag[0]).getByText(/£320\.00/i)).toBeDefined()
    expect(screen.getByTestId('promo-callout')).toBeInTheDocument()
})

test('Renders variant details based on the selected swatch on mobile', async () => {
    useBreakpointValue.mockReturnValue(false)

    const {getAllByRole, getByTestId} = renderWithProviders(
        <ProductTile product={mockProductSearchItem} />
    )
    const swatches = getAllByRole('radio')
    const productImage = getByTestId('product-tile-image')
    const productTile = getByTestId('product-tile')

    // Initial render will show swatched and the image will be the represented product variation
    expect(swatches).toHaveLength(2)
    expect(productImage.firstChild.getAttribute('src')).toBe(
        'https://edge.disstg.commercecloud.salesforce.com/dw/image/v2/ZZRF_001/on/demandware.static/-/Sites-apparel-m-catalog/default/dw23283a20/images/medium/PG.33698RUBN4Q.CHARCWL.PZ.jpg'
    )
    const currentPriceTag = productTile.querySelectorAll('b')
    const strikethroughPriceTag = productTile.querySelectorAll('s')
    expect(currentPriceTag).toHaveLength(1)
    expect(within(currentPriceTag[0]).getByText(/£191\.99/i)).toBeDefined()
    expect(strikethroughPriceTag).toHaveLength(1)
    expect(within(strikethroughPriceTag[0]).getByText(/£320\.00/i)).toBeDefined()

    // Navigating to different color swatch changes the image & price.
    // Default selected swatch is swatches[1] as it is the represented product.
    fireEvent.click(swatches[0])
    await waitFor(() => screen.getByTestId('product-tile-image'))
    expect(productImage.firstChild.getAttribute('src')).toBe(
        'https://edge.disstg.commercecloud.salesforce.com/dw/image/v2/ZZRF_001/on/demandware.static/-/Sites-apparel-m-catalog/default/dwed78c6fc/images/medium/PG.52002RUBN4Q.NAVYWL.PZ.jpg'
    )
    expect(currentPriceTag).toHaveLength(1)
    expect(within(currentPriceTag[0]).getByText(/£143\.99/i)).toBeDefined()
    expect(strikethroughPriceTag).toHaveLength(1)
    expect(within(strikethroughPriceTag[0]).getByText(/£320\.00/i)).toBeDefined()
    expect(screen.getByTestId('promo-callout')).toBeInTheDocument()
})

test('Renders price range with starting price and strikethrough price for master product with multiple variants', async () => {
    useBreakpointValue.mockReturnValue(true)

    const {getByText, getByTestId, getAllByRole, container} = renderWithProviders(
        <ProductTile product={mockMasterProductHitWithMultipleVariants} />
    )
    expect(getByText(/Long Sleeve Embellished Boat Neck Top/i)).toBeInTheDocument()
    const productImage = getByTestId('product-tile-image')
    expect(productImage.firstChild.getAttribute('src')).toBe(
        'https://edge.disstg.commercecloud.salesforce.com/dw/image/v2/ZZRF_001/on/demandware.static/-/Sites-apparel-m-catalog/default/dwc9ce7da9/images/medium/PG.10217069.JJ908XX.PZ.jpg'
    )

    const currentPriceTag = container.querySelectorAll('b')
    const strikethroughPriceTag = container.querySelectorAll('s')

    expect(currentPriceTag).toHaveLength(1)
    expect(within(currentPriceTag[0]).getByText(/From £18\.55/i)).toBeDefined()
    expect(strikethroughPriceTag).toHaveLength(1)
    expect(within(strikethroughPriceTag[0]).getByText(/£31\.36/i)).toBeDefined()

    // Navigating to different color swatch changes the image but keeps the same price range.
    const swatches = getAllByRole('radio')
    // Default selected swatch is swatches[1] as it is the represented product.
    fireEvent.mouseOver(swatches[0])
    await waitFor(() => screen.getByTestId('product-tile-image'))
    expect(productImage.firstChild.getAttribute('src')).toBe(
        'https://edge.disstg.commercecloud.salesforce.com/dw/image/v2/ZZRF_001/on/demandware.static/-/Sites-apparel-m-catalog/default/dwed56b2da/images/medium/PG.10217069.JJ5QZXX.PZ.jpg'
    )
    expect(currentPriceTag).toHaveLength(1)
    expect(within(currentPriceTag[0]).getByText(/From £18\.55/i)).toBeDefined()
    expect(strikethroughPriceTag).toHaveLength(1)
    expect(within(strikethroughPriceTag[0]).getByText(/£31\.36/i)).toBeDefined()
})

test('renders exact price with strikethrough price for master product with one variant', () => {
    const {getAllByText, getByText, queryByText, container} = renderWithProviders(
        <ProductTile product={mockMasterProductHitWithOneVariant} />
    )
    expect(getByText(/black flat front wool suit/i)).toBeInTheDocument()
    expect(getAllByText(/^£191\.99/i)).toHaveLength(1)
    expect(getAllByText(/^£320\.00/i)).toHaveLength(1)
    expect(queryByText(/from/i)).not.toBeInTheDocument()

    const currentPriceTag = container.querySelectorAll('b')
    const strikethroughPriceTag = container.querySelectorAll('s')
    expect(within(currentPriceTag[0]).getByText(/£191\.99/i)).toBeDefined()
    expect(within(strikethroughPriceTag[0]).getByText(/£320\.00/i)).toBeDefined()
    expect(currentPriceTag).toHaveLength(1)
    expect(strikethroughPriceTag).toHaveLength(1)
})

test('Product set - shows range From X where X is the lowest price child', () => {
    const {getByText, queryByText} = renderWithProviders(
        <ProductTile product={mockProductSetHit} />
    )
    expect(getByText(/Winter Look/i)).toBeInTheDocument()
    expect(queryByText(/from £40\.16/i)).toBeInTheDocument()
    expect(queryByText(/£44\.16/i)).not.toBeInTheDocument()
})

test('renders strike through price with standard product', () => {
    const {getByText, container} = renderWithProviders(
        <ProductTile product={mockStandardProductHit} />
    )
    expect(getByText(/Laptop Briefcase with wheels \(37L\)/i)).toBeInTheDocument()
    expect(getByText(/^£63\.99/i)).toBeInTheDocument()
    const currentPriceTag = container.querySelectorAll('b')
    const strikethroughPriceTag = container.querySelectorAll('s')
    expect(within(currentPriceTag[0]).getByText(/£63\.99/i)).toBeDefined()
    expect(within(strikethroughPriceTag[0]).getByText(/£67\.99/i)).toBeDefined()
    expect(currentPriceTag).toHaveLength(1)
    expect(strikethroughPriceTag).toHaveLength(1)
})

test('renders badges corresponding to the default custom properties', () => {
    const {getByText, getAllByTestId} = renderWithProviders(
        <ProductTile product={mockStandardProductHit} />
    )
    expect(getByText(/Laptop Briefcase with wheels \(37L\)/i)).toBeInTheDocument()
    const badges = getAllByTestId('product-badge')
    expect(badges).toHaveLength(2)
    expect(within(badges[0]).getByText(/New/i)).toBeDefined()
    expect(within(badges[1]).getByText(/Sale/i)).toBeDefined()
})

test('renders badges corresponding to the overridden custom properties', () => {
    const {getByText, getAllByTestId} = renderWithProviders(
        <ProductTile
            product={mockStandardProductHit}
            badgeDetails={[
                {
                    propertyName: 'c_isSpecial',
                    label: {id: 'product_tile.badge.label.special', defaultMessage: 'Special'},
                    color: 'green'
                },
                {
                    propertyName: 'c_isCloseout',
                    label: {id: 'product_tile.badge.label.closeout', defaultMessage: 'Closeout'},
                    color: 'yellow'
                }
            ]}
        />
    )
    expect(getByText(/Laptop Briefcase with wheels \(37L\)/i)).toBeInTheDocument()
    const badges = getAllByTestId('product-badge')
    expect(badges).toHaveLength(1)
    expect(within(badges[0]).getByText(/Special/i)).toBeDefined()
})

test('renders only unique badges', () => {
    const {getByText, getAllByTestId} = renderWithProviders(
        <ProductTile
            product={mockStandardProductHit}
            badgeDetails={[
                {
                    propertyName: 'c_isSpecial',
                    label: {id: 'product_tile.badge.label.special', defaultMessage: 'Special'},
                    color: 'green'
                },
                {
                    propertyName: 'c_isSpecial',
                    label: {
                        id: 'product_tile.badge.label.special',
                        defaultMessage: 'Extra Special'
                    },
                    color: 'yellow'
                },
                {
                    propertyName: 'c_isSpecial',
                    label: {id: 'product_tile.badge.label.special', defaultMessage: 'Special'},
                    color: 'red'
                }
            ]}
        />
    )
    expect(getByText(/Laptop Briefcase with wheels \(37L\)/i)).toBeInTheDocument()
    const badges = getAllByTestId('product-badge')
    expect(badges).toHaveLength(2)
    expect(within(badges[0]).getByText(/Special/i)).toBeDefined()
    expect(within(badges[1]).getByText(/Extra Special/i)).toBeDefined()
})

test('Ignores the badges that are NOT defined as custom properties', () => {
    const {getByText, getAllByTestId} = renderWithProviders(
        <ProductTile
            product={mockStandardProductHit}
            badgeDetails={[
                {
                    propertyName: 'c_isSpecial',
                    label: {id: 'product_tile.badge.label.special', defaultMessage: 'Special'},
                    color: 'green'
                },
                {
                    propertyName: 'c_isNotAvailable',
                    label: {
                        id: 'product_tile.badge.label.test',
                        defaultMessage: 'Test'
                    },
                    color: 'yellow'
                }
            ]}
        />
    )
    expect(getByText(/Laptop Briefcase with wheels \(37L\)/i)).toBeInTheDocument()
    const badges = getAllByTestId('product-badge')
    expect(badges).toHaveLength(1)
    expect(within(badges[0]).getByText(/Special/i)).toBeDefined()
})

test('Ignores the badges that are NOT defined as boolean custom properties', () => {
    const {getByText, getAllByTestId} = renderWithProviders(
        <ProductTile
            product={mockStandardProductHit}
            badgeDetails={[
                {
                    propertyName: 'c_isSpecial',
                    label: {id: 'product_tile.badge.label.special', defaultMessage: 'Special'},
                    color: 'green'
                },
                {
                    propertyName: 'c_styleNumber',
                    label: {
                        id: 'product_tile.badge.label.test',
                        defaultMessage: 'Test'
                    },
                    color: 'yellow'
                }
            ]}
        />
    )
    expect(getByText(/Laptop Briefcase with wheels \(37L\)/i)).toBeInTheDocument()
    const badges = getAllByTestId('product-badge')
    expect(badges).toHaveLength(1)
    expect(within(badges[0]).getByText(/Special/i)).toBeDefined()
})

describe('given add-to-cart is not enabled', () => {
    describe('when a product tile renders', () => {
        test('then neither the add to cart nor the select options button is shown', () => {
            const {queryByTestId} = renderWithProviders(
                <ProductTile product={mockStandardProductHit} />
            )

            expect(queryByTestId('product-tile-add-to-cart-button')).not.toBeInTheDocument()
            expect(queryByTestId('product-tile-select-options-button')).not.toBeInTheDocument()
        })
    })
})

describe('given a standard, orderable product', () => {
    describe('when add-to-cart is enabled', () => {
        test('then an Add to Cart button is rendered', () => {
            const {getByTestId, queryByTestId} = renderWithProviders(
                <ProductTile product={mockStandardProductHit} enableAddToCart={true} />
            )

            const button = getByTestId('product-tile-add-to-cart-button')
            expect(button).toBeInTheDocument()
            expect(button).toBeEnabled()
            expect(within(button).getByText(/add to cart/i)).toBeInTheDocument()
            expect(queryByTestId('product-tile-select-options-button')).not.toBeInTheDocument()
        })
    })

    describe('when the Add to Cart button is clicked', () => {
        test('then the product is added to the basket and a success toast is shown', async () => {
            const {getByTestId} = renderWithProviders(
                <ProductTile product={mockStandardProductHit} enableAddToCart={true} />
            )

            fireEvent.click(getByTestId('product-tile-add-to-cart-button'))

            await waitFor(() => {
                expect(mockAddItemToNewOrExistingBasket).toHaveBeenCalledWith([
                    {productId: 'P0048M', price: 63.99, quantity: 1}
                ])
            })
            await waitFor(() => {
                expect(mockShowToast).toHaveBeenCalledWith(
                    expect.objectContaining({status: 'success'})
                )
            })
            expect(mockSendAddToCart).toHaveBeenCalledTimes(1)
        })
    })

    describe('when adding to the basket fails', () => {
        test('then an error toast is shown and no success toast is shown', async () => {
            mockAddItemToNewOrExistingBasket.mockRejectedValue(new Error('network error'))

            const {getByTestId} = renderWithProviders(
                <ProductTile product={mockStandardProductHit} enableAddToCart={true} />
            )

            fireEvent.click(getByTestId('product-tile-add-to-cart-button'))

            await waitFor(() => {
                expect(mockShowToast).toHaveBeenCalledWith(
                    expect.objectContaining({status: 'error'})
                )
            })
            expect(mockShowToast).not.toHaveBeenCalledWith(
                expect.objectContaining({status: 'success'})
            )
        })
    })
})

describe('given an out-of-stock standard product', () => {
    describe('when add-to-cart is enabled', () => {
        test('then the action button is disabled and labelled Sold Out', () => {
            const {getByTestId} = renderWithProviders(
                <ProductTile
                    product={{...mockStandardProductHit, orderable: false}}
                    enableAddToCart={true}
                />
            )

            const button = getByTestId('product-tile-add-to-cart-button')
            expect(button).toBeDisabled()
            expect(within(button).getByText(/sold out/i)).toBeInTheDocument()
        })

        test('then clicking it does not add to the basket', () => {
            const {getByTestId} = renderWithProviders(
                <ProductTile
                    product={{...mockStandardProductHit, orderable: false}}
                    enableAddToCart={true}
                />
            )

            fireEvent.click(getByTestId('product-tile-add-to-cart-button'))
            expect(mockAddItemToNewOrExistingBasket).not.toHaveBeenCalled()
        })
    })
})

describe('given a product that requires variant selection', () => {
    describe('when add-to-cart is enabled for a master product', () => {
        test('then a Select Options link to the PDP is rendered instead of Add to Cart', () => {
            const {getByTestId, queryByTestId} = renderWithProviders(
                <ProductTile product={mockMasterProductHitWithOneVariant} enableAddToCart={true} />
            )

            const button = getByTestId('product-tile-select-options-button')
            expect(button).toBeInTheDocument()
            expect(within(button).getByText(/select options/i)).toBeInTheDocument()
            expect(button).toHaveAttribute('href', expect.stringContaining('25686544M'))
            expect(queryByTestId('product-tile-add-to-cart-button')).not.toBeInTheDocument()
        })
    })

    describe('when add-to-cart is enabled for a product set', () => {
        test('then a Select Options link is rendered instead of Add to Cart', () => {
            const {getByTestId, queryByTestId} = renderWithProviders(
                <ProductTile product={mockProductSetHit} enableAddToCart={true} />
            )

            expect(getByTestId('product-tile-select-options-button')).toBeInTheDocument()
            expect(queryByTestId('product-tile-add-to-cart-button')).not.toBeInTheDocument()
        })
    })
})
