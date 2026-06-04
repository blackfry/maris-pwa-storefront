/*
 * Copyright (c) 2022, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import React, {useMemo, useRef, useState} from 'react'
import PropTypes from 'prop-types'
import DisplayPrice from '@salesforce/retail-react-app/app/components/display-price'

// Components
import {
    AspectRatio,
    Badge,
    Box,
    Button,
    Skeleton as ChakraSkeleton,
    Text,
    Stack,
    useMultiStyleConfig,
    IconButton,
    HStack
} from '@salesforce/retail-react-app/app/components/shared/ui'
import DynamicImage from '@salesforce/retail-react-app/app/components/dynamic-image'

// Project Components
import {HeartIcon, HeartSolidIcon} from '@salesforce/retail-react-app/app/components/icons'
import Link from '@salesforce/retail-react-app/app/components/link'
import Swatch from '@salesforce/retail-react-app/app/components/swatch-group/swatch'
import SwatchGroup from '@salesforce/retail-react-app/app/components/swatch-group'
import withRegistration from '@salesforce/retail-react-app/app/components/with-registration'
import PromoCallout from '@salesforce/retail-react-app/app/components/product-tile/promo-callout'

// Hooks
import {useIntl} from 'react-intl'
import {useShopperBasketsV2MutationHelper as useShopperBasketsMutationHelper} from '@salesforce/commerce-sdk-react'
import {useToast} from '@salesforce/retail-react-app/app/hooks/use-toast'
import useEinstein from '@salesforce/retail-react-app/app/hooks/use-einstein'
import useNavigation from '@salesforce/retail-react-app/app/hooks/use-navigation'

// Other
import {
    API_ERROR_MESSAGE,
    PRODUCT_TILE_IMAGE_VIEW_TYPE,
    PRODUCT_TILE_SELECTABLE_ATTRIBUTE_ID
} from '@salesforce/retail-react-app/app/constants'
import {productUrlBuilder, rebuildPathWithParams} from '@salesforce/retail-react-app/app/utils/url'
import {getPriceData} from '@salesforce/retail-react-app/app/utils/product-utils'
import {useCurrency} from '@salesforce/retail-react-app/app/hooks'
import {
    filterImageGroups,
    getDecoratedVariationAttributes
} from '@salesforce/retail-react-app/app/utils/product-utils'
import {PRODUCT_BADGE_DETAILS} from '@salesforce/retail-react-app/app/constants'

const IconButtonWithRegistration = withRegistration(IconButton)

// Component Skeleton
const PricingAndPromotionsSkeleton = () => {
    return (
        <Stack spacing={2} data-testid="sf-product-tile-pricing-and-promotions-skeleton">
            <ChakraSkeleton width="80px" height="20px" />
            <ChakraSkeleton width={{base: '120px', md: '220px'}} height="12px" />
        </Stack>
    )
}

export const Skeleton = () => {
    const styles = useMultiStyleConfig('ProductTile')
    return (
        <Box data-testid="sf-product-tile-skeleton">
            <Stack spacing={2}>
                <Box {...styles.imageWrapper}>
                    <AspectRatio ratio={1} {...styles.image}>
                        <ChakraSkeleton />
                    </AspectRatio>
                </Box>
                <PricingAndPromotionsSkeleton />
            </Stack>
        </Box>
    )
}

/**
 * The ProductTile is a simple visual representation of a
 * product object. It will show its default image, name and price.
 * It also supports favourite products, controlled by a heart icon.
 *
 * When `enableAddToCart` is set, an action button is rendered beneath the
 * pricing. A standard, orderable product (`productType.item`) can be added to
 * the basket in a single click directly from the tile. A product that requires
 * a variant selection (master/set/bundle) cannot be added blindly, so the tile
 * instead links to the product detail page where the shopper picks the variant.
 */
const ProductTile = (props) => {
    const {
        dynamicImageProps,
        enableFavourite = false,
        enableAddToCart = false,
        imageViewType = PRODUCT_TILE_IMAGE_VIEW_TYPE,
        isFavourite,
        onFavouriteToggle,
        product,
        selectableAttributeId = PRODUCT_TILE_SELECTABLE_ATTRIBUTE_ID,
        badgeDetails = PRODUCT_BADGE_DETAILS,
        isRefreshingData = false,
        ...rest
    } = props
    const {imageGroups, productId, representedProduct, variants} = product

    const intl = useIntl()
    const {currency} = useCurrency()
    const isFavouriteLoading = useRef(false)
    const styles = useMultiStyleConfig('ProductTile')

    // Add-to-cart wiring. These hooks are inexpensive at render time (no network
    // request is made until the mutation is invoked), so it is safe to call them
    // unconditionally even when `enableAddToCart` is false.
    const {addItemToNewOrExistingBasket} = useShopperBasketsMutationHelper()
    const showToast = useToast()
    const einstein = useEinstein()
    const navigate = useNavigation()
    const [isAddingToCart, setIsAddingToCart] = useState(false)

    const isMasterVariant = !!variants
    const initialVariationValue =
        isMasterVariant && !!representedProduct
            ? variants?.find((variant) => variant.productId == product.representedProduct.id)
                  ?.variationValues?.[selectableAttributeId]
            : undefined

    const [selectableAttributeValue, setSelectableAttributeValue] = useState(initialVariationValue)

    // Primary image for the tile, the image is determined from the product and selected variation attributes.
    const image = useMemo(() => {
        // NOTE: If the selectable variation attribute doesn't exist in the products variation attributes
        // array, lets not filter the image groups on it. This ensures we always return an image for non-variant
        // type products.
        const hasSelectableAttribute = product?.variationAttributes?.find(
            ({id}) => id === selectableAttributeId
        )

        const variationValues = {[selectableAttributeId]: selectableAttributeValue}
        const filteredImageGroups = filterImageGroups(imageGroups, {
            viewType: imageViewType,
            variationValues: hasSelectableAttribute ? variationValues : {}
        })

        // Return the first image of the first group.
        return filteredImageGroups?.[0]?.images[0]
    }, [product, selectableAttributeId, selectableAttributeValue, imageViewType])

    // Primary URL user to wrap the ProduceTile.
    const productUrl = useMemo(
        () =>
            rebuildPathWithParams(productUrlBuilder({id: productId}), {
                [selectableAttributeId]: selectableAttributeValue
            }),
        [product, selectableAttributeId, selectableAttributeValue]
    )

    // NOTE: variationAttributes are only defined for master/variant type products.
    const variationAttributes = useMemo(() => getDecoratedVariationAttributes(product), [product])

    // ProductTile is used by two components, RecommendedProducts and ProductList.
    // RecommendedProducts provides a localized product name as `name` and non-localized product
    // name as `productName`. ProductList provides a localized name as `productName` and does not
    // use the `name` property.
    const localizedProductName = product.name ?? product.productName

    const productWithFilteredVariants = useMemo(() => {
        const variants = product?.variants?.filter(
            ({variationValues}) =>
                variationValues[selectableAttributeId] === selectableAttributeValue
        )
        return {
            ...product,
            variants
        }
    }, [product, selectableAttributeId, selectableAttributeValue])

    // Pricing is dynamic! Ensure we are showing the right price for the selected variation attribute
    // value.
    const priceData = useMemo(() => {
        return getPriceData(productWithFilteredVariants)
    }, [productWithFilteredVariants])

    // Retrieve product badges
    const filteredLabels = useMemo(() => {
        const labelsMap = new Map()
        if (product?.representedProduct) {
            badgeDetails.forEach((item) => {
                if (
                    item.propertyName &&
                    typeof product.representedProduct[item.propertyName] === 'boolean' &&
                    product.representedProduct[item.propertyName] === true
                ) {
                    labelsMap.set(intl.formatMessage(item.label), item.color)
                }
            })
        }
        return labelsMap
    }, [product, badgeDetails])

    // A product requires a variant selection on the PDP unless it is a plain,
    // single-SKU standard product. We treat anything that is not explicitly an
    // `item` (i.e. masters, sets and bundles) as needing selection.
    const requiresVariantSelection = !product?.productType?.item
    const isOrderable = product?.orderable !== false

    const handleAddToCart = async () => {
        if (isAddingToCart) {
            return
        }
        setIsAddingToCart(true)
        try {
            const productItems = [
                {
                    productId,
                    price: product.price,
                    quantity: 1
                }
            ]
            await addItemToNewOrExistingBasket(productItems)
            einstein.sendAddToCart([{product, productId, price: product.price, quantity: 1}])
            showToast({
                title: intl.formatMessage(
                    {
                        id: 'product_tile.toast.added_to_cart',
                        defaultMessage:
                            '{quantity} {quantity, plural, one {item} other {items}} added to cart'
                    },
                    {quantity: 1}
                ),
                status: 'success',
                action: (
                    // The Chakra toast is rendered through a portal that is outside
                    // the intl provider, so the intl-aware Link component cannot be
                    // used here. We navigate imperatively instead.
                    <Button variant="link" onClick={() => navigate('/cart')}>
                        {intl.formatMessage({
                            id: 'product_tile.toast.action_view_cart',
                            defaultMessage: 'View Cart'
                        })}
                    </Button>
                )
            })
        } catch (error) {
            showToast({
                title: intl.formatMessage(API_ERROR_MESSAGE),
                status: 'error'
            })
        } finally {
            setIsAddingToCart(false)
        }
    }

    return (
        <Box {...styles.container} display="flex" flexDirection="column" height="100%">
            <Link
                data-testid="product-tile"
                to={productUrl}
                {...styles.link}
                flexGrow={1}
                {...rest}
            >
                <Box {...styles.imageWrapper}>
                    <AspectRatio {...styles.image}>
                        <DynamicImage
                            data-testid="product-tile-image"
                            src={`${
                                image?.disBaseLink ||
                                image?.link ||
                                product?.image?.disBaseLink ||
                                product?.image?.link
                            }[?sw={width}&q=60]`}
                            widths={dynamicImageProps?.widths}
                            imageProps={{
                                // treat img as a decorative item, we don't need to pass `image.alt`
                                // since it is the same as product name
                                // which can cause confusion for individuals who uses screen readers
                                alt: '',
                                loading: 'lazy',
                                ...dynamicImageProps?.imageProps
                            }}
                        />
                    </AspectRatio>
                </Box>

                {/* Swatches — kept in a fixed-height row so the swatch, title
                    and price line up across every tile in a PLP grid row,
                    whether or not the product has colour variations. The
                    reserved height matches a single swatch row (circle 2.75rem
                    + 0.5rem gap = 3.25rem). */}
                <Box minHeight="3.25rem">
                    {variationAttributes
                        ?.filter(({id}) => selectableAttributeId === id)
                        ?.map(({id, name, values}) => (
                            <SwatchGroup
                                ariaLabel={name}
                                key={id}
                                value={selectableAttributeValue}
                                handleChange={(value) => {
                                    setSelectableAttributeValue(value)
                                }}
                            >
                                {values?.map(({name, swatch, value}) => {
                                    const content = swatch ? (
                                        <Box
                                            height="100%"
                                            width="100%"
                                            minWidth="32px"
                                            backgroundRepeat="no-repeat"
                                            backgroundSize="cover"
                                            backgroundColor={name.toLowerCase()}
                                            backgroundImage={`url(${
                                                swatch?.disBaseLink || swatch.link
                                            })`}
                                        />
                                    ) : (
                                        name
                                    )

                                    return (
                                        <Swatch
                                            key={value}
                                            value={value}
                                            name={name}
                                            variant={'circle'}
                                            isFocusable={true}
                                        >
                                            {content}
                                        </Swatch>
                                    )
                                })}
                            </SwatchGroup>
                        ))}
                </Box>

                {/* Title — reserve two lines so the price row lines up across
                    tiles whose names wrap to one vs two lines. */}
                <Text {...styles.title} noOfLines={2} minHeight="3em">
                    {localizedProductName}
                </Text>

                {isRefreshingData ? (
                    <PricingAndPromotionsSkeleton />
                ) : (
                    <>
                        {/* Price */}
                        <DisplayPrice priceData={priceData} currency={currency} />

                        {/* Promotion call-out message */}
                        {shouldShowPromoCallout(productWithFilteredVariants) && (
                            <PromoCallout product={productWithFilteredVariants} />
                        )}
                    </>
                )}
            </Link>

            {/* Add to cart / select options action.
                Rendered outside the wrapping Link so the button is not nested
                inside an anchor (invalid + breaks keyboard interaction). */}
            {enableAddToCart &&
                (requiresVariantSelection ? (
                    <Button
                        as={Link}
                        to={productUrl}
                        data-testid="product-tile-select-options-button"
                        variant="outline"
                        width="full"
                        marginTop={3}
                    >
                        {intl.formatMessage({
                            id: 'product_tile.button.select_options',
                            defaultMessage: 'Select Options'
                        })}
                    </Button>
                ) : (
                    <Button
                        data-testid="product-tile-add-to-cart-button"
                        width="full"
                        marginTop={3}
                        isLoading={isAddingToCart}
                        isDisabled={!isOrderable}
                        onClick={handleAddToCart}
                    >
                        {isOrderable
                            ? intl.formatMessage({
                                  id: 'product_tile.button.add_to_cart',
                                  defaultMessage: 'Add to Cart'
                              })
                            : intl.formatMessage({
                                  id: 'product_tile.button.sold_out',
                                  defaultMessage: 'Sold Out'
                              })}
                    </Button>
                ))}

            {enableFavourite && (
                <Box
                    onClick={(e) => {
                        // stop click event from bubbling
                        // to avoid user from clicking the underlying
                        // product while the favourite icon is disabled
                        e.preventDefault()
                    }}
                >
                    <IconButtonWithRegistration
                        data-testid="wishlist-button"
                        aria-label={
                            isFavourite
                                ? intl.formatMessage(
                                      {
                                          id: 'product_tile.assistive_msg.remove_from_wishlist',
                                          defaultMessage: 'Remove {product} from wishlist'
                                      },
                                      {product: localizedProductName}
                                  )
                                : intl.formatMessage(
                                      {
                                          id: 'product_tile.assistive_msg.add_to_wishlist',
                                          defaultMessage: 'Add {product} to wishlist'
                                      },
                                      {product: localizedProductName}
                                  )
                        }
                        icon={isFavourite ? <HeartSolidIcon /> : <HeartIcon />}
                        {...styles.favIcon}
                        onClick={async () => {
                            if (!isFavouriteLoading.current) {
                                isFavouriteLoading.current = true
                                await onFavouriteToggle(!isFavourite)
                                isFavouriteLoading.current = false
                            }
                        }}
                    />
                </Box>
            )}
            {filteredLabels.size > 0 && (
                <HStack {...styles.badgeGroup}>
                    {Array.from(filteredLabels.entries()).map(([label, colorScheme]) => (
                        <Badge key={label} data-testid="product-badge" colorScheme={colorScheme}>
                            {label}
                        </Badge>
                    ))}
                </HStack>
            )}
        </Box>
    )
}

ProductTile.displayName = 'ProductTile'

ProductTile.propTypes = {
    /**
     * The product search hit that will be represented in this
     * component.
     */
    product: PropTypes.shape({
        currency: PropTypes.string,
        image: PropTypes.shape({
            alt: PropTypes.string,
            disBaseLink: PropTypes.string,
            link: PropTypes.string
        }),
        imageGroups: PropTypes.array,
        price: PropTypes.number,
        priceRanges: PropTypes.array,
        tieredPrices: PropTypes.array,
        // `name` is present and localized when `product` is provided by a RecommendedProducts component
        // (from Shopper Products `getProducts` endpoint), but is not present when `product` is
        // provided by a ProductList component.
        // See: https://developer.salesforce.com/docs/commerce/commerce-api/references/shopper-products?meta=getProducts
        name: PropTypes.string,
        // `productName` is localized when provided by a ProductList component (from Shopper Search
        // `productSearch` endpoint), but is NOT localized when provided by a RecommendedProducts
        // component (from Einstein Recommendations `getRecommendations` endpoint).
        // See: https://developer.salesforce.com/docs/commerce/commerce-api/references/shopper-search?meta=productSearch
        // See: https://developer.salesforce.com/docs/commerce/einstein-api/references/einstein-api-quick-start-guide?meta=getRecommendations
        // Note: useEinstein() transforms snake_case property names from the API response to camelCase
        productName: PropTypes.string,
        productId: PropTypes.string,
        productPromotions: PropTypes.array,
        representedProduct: PropTypes.object,
        hitType: PropTypes.string,
        variationAttributes: PropTypes.array,
        variants: PropTypes.array,
        // Whether this search hit can be ordered. Standard products that are out
        // of stock surface this as `false`.
        orderable: PropTypes.bool,
        // The product class of the search hit. Only `item` (a single SKU) can be
        // added to the basket directly from the tile.
        productType: PropTypes.shape({
            item: PropTypes.bool,
            master: PropTypes.bool,
            set: PropTypes.bool,
            bundle: PropTypes.bool,
            variant: PropTypes.bool,
            variationGroup: PropTypes.bool
        }),
        type: PropTypes.shape({
            set: PropTypes.bool,

            bundle: PropTypes.bool,
            item: PropTypes.bool
        })
    }),
    /**
     * Enable adding/removing product as a favourite.
     * Use case: wishlist.
     */
    enableFavourite: PropTypes.bool,
    /**
     * Enable a quick add-to-cart action on the tile. Standard products are added
     * to the basket directly; products requiring variant selection link to the PDP.
     */
    enableAddToCart: PropTypes.bool,
    /**
     * Display the product as a favourite.
     */
    isFavourite: PropTypes.bool,
    /**
     * Callback function to be invoked when the user
     * interacts with favourite icon/button.
     */
    onFavouriteToggle: PropTypes.func,
    /**
     * The `viewType` of the image component. This defaults to 'large'.
     */
    imageViewType: PropTypes.string,
    /**
     * When displaying a master/variant product, this value represents the variation attribute that is displayed
     * as a swatch below the main image. The default for this property is `color`.
     */
    selectableAttributeId: PropTypes.string,
    dynamicImageProps: PropTypes.object,
    /**
     * Details of badge labels and the corresponding product custom properties that enable badges.
     */
    badgeDetails: PropTypes.array,
    /**
     * Determines whether to display a skeleton over personalizable data (e.g., pricing and promotions) during data refresh.
     */
    isRefreshingData: PropTypes.bool
}

export default ProductTile

const shouldShowPromoCallout = (productWithFilteredVariants) => {
    return productWithFilteredVariants.variants
        ? Boolean(productWithFilteredVariants.variants.find((variant) => variant.productPromotions))
        : Boolean(productWithFilteredVariants.productPromotions)
}
