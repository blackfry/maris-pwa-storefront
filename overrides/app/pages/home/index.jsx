/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useEffect} from 'react'
import {useIntl, FormattedMessage} from 'react-intl'
import {useLocation} from 'react-router-dom'
import PropTypes from 'prop-types'

// Components
import {
    AspectRatio,
    Box,
    Button,
    Container,
    Flex,
    Heading,
    Image,
    SimpleGrid,
    Stack,
    Text
} from '@salesforce/retail-react-app/app/components/shared/ui'

// Project Components
import Hero from '@salesforce/retail-react-app/app/components/hero'
import Seo from '@salesforce/retail-react-app/app/components/seo'
import Section from '@salesforce/retail-react-app/app/components/section'
import ProductScroller from '@salesforce/retail-react-app/app/components/product-scroller'
import Link from '@salesforce/retail-react-app/app/components/link'
import {
    StoreIcon,
    ReceiptIcon,
    LockIcon,
    CheckCircleIcon
} from '@salesforce/retail-react-app/app/components/icons'

// Others
import {getAssetUrl} from '@salesforce/pwa-kit-react-sdk/ssr/universal/utils'

// Hooks
import useEinstein from '@salesforce/retail-react-app/app/hooks/use-einstein'
import {useServerContext} from '@salesforce/pwa-kit-react-sdk/ssr/universal/hooks'
import {useProductSearch, useCategory} from '@salesforce/commerce-sdk-react'

// Constants
import {
    CUSTOM_HOME_TITLE,
    HOME_HERO_CATEGORY_ID,
    HOME_SHOP_PRODUCTS_CATEGORY_ID,
    HOME_SHOP_PRODUCTS_LIMIT,
    HOME_CATEGORY_SHOWCASE_LIMIT,
    HOME_FEATURED_LIMIT,
    CAT_MENU_DEFAULT_ROOT_CATEGORY,
    MAX_CACHE_AGE,
    STALE_WHILE_REVALIDATE
} from '../../constants'

const PRODUCT_EXPAND = ['promotions', 'variations', 'prices', 'images', 'custom_properties']

/**
 * A single "shop by category" tile. Links to the category PLP and shows the
 * category's merchandised image when present, otherwise a branded gradient
 * with the category name so the grid never has holes.
 */
const CategoryTile = ({category}) => {
    const href = `/category/${category.id}`
    const image = category.image
    return (
        <Link to={href} aria-label={category.name} _hover={{textDecoration: 'none'}}>
            <AspectRatio ratio={4 / 5} borderRadius="md" overflow="hidden">
                <Box position="relative" bg="gray.100" role="group">
                    {image ? (
                        <Image
                            src={image}
                            alt=""
                            objectFit="cover"
                            width="100%"
                            height="100%"
                            transition="transform 0.4s ease"
                            _groupHover={{transform: 'scale(1.05)'}}
                        />
                    ) : (
                        <Box
                            width="100%"
                            height="100%"
                            bgGradient="linear(to-br, blue.500, purple.600)"
                            transition="transform 0.4s ease"
                            _groupHover={{transform: 'scale(1.05)'}}
                        />
                    )}
                    <Flex
                        position="absolute"
                        inset={0}
                        align="flex-end"
                        bgGradient="linear(to-t, blackAlpha.700, transparent 60%)"
                        p={4}
                    >
                        <Heading as="h3" fontSize="lg" color="white" fontWeight="bold">
                            {category.name}
                        </Heading>
                    </Flex>
                </Box>
            </AspectRatio>
        </Link>
    )
}

CategoryTile.propTypes = {
    category: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        image: PropTypes.string
    }).isRequired
}

const VALUE_PROPS = [
    {
        icon: StoreIcon,
        title: {id: 'home.value.shipping.title', defaultMessage: 'Free shipping over $50'},
        body: {id: 'home.value.shipping.body', defaultMessage: 'On every order, every day'}
    },
    {
        icon: ReceiptIcon,
        title: {id: 'home.value.returns.title', defaultMessage: 'Easy 30-day returns'},
        body: {id: 'home.value.returns.body', defaultMessage: 'No questions asked'}
    },
    {
        icon: LockIcon,
        title: {id: 'home.value.secure.title', defaultMessage: 'Secure checkout'},
        body: {id: 'home.value.secure.body', defaultMessage: 'Encrypted end to end'}
    },
    {
        icon: CheckCircleIcon,
        title: {id: 'home.value.support.title', defaultMessage: 'Real human support'},
        body: {id: 'home.value.support.body', defaultMessage: 'Here for you 7 days a week'}
    }
]

/**
 * Storefront home page. Presents a hero, trust badges, a data-driven
 * "shop by category" grid, new-arrival and featured product scrollers, and a
 * promotional sign-up banner — the spine of a typical retail home page.
 */
const Home = () => {
    const intl = useIntl()
    const einstein = useEinstein()
    const {pathname} = useLocation()

    // useServerContext returns the request/response objects on the server and
    // undefined on the client, letting us set SSR cache headers in one place.
    const {res} = useServerContext()
    if (res) {
        res.set(
            'Cache-Control',
            `s-maxage=${MAX_CACHE_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`
        )
    }

    // Root category tree — already warmed by the app shell's nav menu, so this
    // is a react-query cache hit rather than a second request.
    const {data: rootCategory} = useCategory({
        parameters: {id: CAT_MENU_DEFAULT_ROOT_CATEGORY, levels: 1}
    })
    const topCategories = (rootCategory?.categories ?? []).slice(0, HOME_CATEGORY_SHOWCASE_LIMIT)
    const featuredCategory = rootCategory?.categories?.[0]

    const {data: newArrivals, isLoading: newArrivalsLoading} = useProductSearch({
        parameters: {
            refine: [`cgid=${HOME_SHOP_PRODUCTS_CATEGORY_ID}`, 'htype=master'],
            expand: PRODUCT_EXPAND,
            perPricebook: true,
            allVariationProperties: true,
            limit: HOME_SHOP_PRODUCTS_LIMIT
        }
    })

    const {data: featured, isLoading: featuredLoading} = useProductSearch(
        {
            parameters: {
                refine: [`cgid=${featuredCategory?.id}`, 'htype=master'],
                expand: PRODUCT_EXPAND,
                perPricebook: true,
                allVariationProperties: true,
                limit: HOME_FEATURED_LIMIT
            }
        },
        {enabled: Boolean(featuredCategory?.id)}
    )

    /**************** Einstein ****************/
    useEffect(() => {
        einstein.sendViewPage(pathname)
    }, [])

    return (
        <Box data-testid="home-page" layerStyle="page">
            <Seo
                title="Home"
                description="Shop the latest arrivals, top categories and featured products."
                keywords="online store, shop, new arrivals, fashion, electronics"
            />

            <Hero
                title={CUSTOM_HOME_TITLE}
                img={{
                    src: getAssetUrl('static/img/hero.png'),
                    alt: ''
                }}
                actions={
                    <Stack spacing={5}>
                        <Text fontSize={{base: 'md', md: 'lg'}} color="gray.700" maxW="md">
                            <FormattedMessage
                                defaultMessage="Fresh drops, everyday essentials and the pieces everyone's talking about — all in one place."
                                id="home.hero.subtitle"
                            />
                        </Text>
                        <Stack spacing={{base: 4, sm: 4}} direction={{base: 'column', sm: 'row'}}>
                            <Button
                                as={Link}
                                to={`/category/${HOME_HERO_CATEGORY_ID}`}
                                width={{base: 'full', sm: 'inherit'}}
                                paddingX={8}
                                _hover={{textDecoration: 'none'}}
                            >
                                <FormattedMessage
                                    defaultMessage="Shop new arrivals"
                                    id="home.hero.cta_primary"
                                />
                            </Button>
                            {featuredCategory && (
                                <Button
                                    as={Link}
                                    to={`/category/${featuredCategory.id}`}
                                    variant="outline"
                                    width={{base: 'full', sm: 'inherit'}}
                                    paddingX={8}
                                    _hover={{textDecoration: 'none'}}
                                >
                                    <FormattedMessage
                                        defaultMessage="Browse {category}"
                                        id="home.hero.cta_secondary"
                                        values={{category: featuredCategory.name}}
                                    />
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                }
            />

            {/* Trust / value-proposition strip */}
            <Box bg="gray.50" borderRadius="base" mb={{base: 8, md: 16}}>
                <Container maxW="6xl" py={{base: 6, md: 8}}>
                    <SimpleGrid columns={{base: 2, md: 4}} spacing={{base: 6, md: 8}}>
                        {VALUE_PROPS.map(({icon: Icon, title, body}) => (
                            <Flex key={title.id} align="center" gap={3}>
                                <Icon boxSize={7} color="blue.600" flexShrink={0} />
                                <Box>
                                    <Text fontWeight="bold" fontSize="sm">
                                        {intl.formatMessage(title)}
                                    </Text>
                                    <Text fontSize="xs" color="gray.600">
                                        {intl.formatMessage(body)}
                                    </Text>
                                </Box>
                            </Flex>
                        ))}
                    </SimpleGrid>
                </Container>
            </Box>

            {/* Shop by category */}
            {topCategories.length > 0 && (
                <Section
                    paddingTop={4}
                    title={intl.formatMessage({
                        defaultMessage: 'Shop by category',
                        id: 'home.heading.shop_by_category'
                    })}
                    subtitle={intl.formatMessage({
                        defaultMessage: 'Find exactly what you came for.',
                        id: 'home.subtitle.shop_by_category'
                    })}
                >
                    <Container maxW="6xl" pt={8}>
                        <SimpleGrid columns={{base: 2, md: 3}} spacing={{base: 4, md: 6}}>
                            {topCategories.map((category) => (
                                <CategoryTile key={category.id} category={category} />
                            ))}
                        </SimpleGrid>
                    </Container>
                </Section>
            )}

            {/* New arrivals */}
            {(newArrivalsLoading || newArrivals?.hits?.length > 0) && (
                <Section
                    padding={4}
                    paddingTop={8}
                    title={intl.formatMessage({
                        defaultMessage: 'New arrivals',
                        id: 'home.heading.new_arrivals'
                    })}
                    subtitle={intl.formatMessage({
                        defaultMessage: 'Just landed — get them before they go.',
                        id: 'home.subtitle.new_arrivals'
                    })}
                >
                    <Stack pt={8} spacing={16}>
                        <ProductScroller
                            products={newArrivals?.hits}
                            isLoading={newArrivalsLoading}
                        />
                    </Stack>
                </Section>
            )}

            {/* Promotional banner */}
            <Container maxW="6xl" mb={{base: 8, md: 16}}>
                <Flex
                    direction={{base: 'column', md: 'row'}}
                    align="center"
                    justify="space-between"
                    gap={6}
                    bgGradient="linear(to-r, blue.600, purple.600)"
                    color="white"
                    borderRadius="lg"
                    p={{base: 8, md: 12}}
                    textAlign={{base: 'center', md: 'left'}}
                >
                    <Box>
                        <Heading as="h2" fontSize={{base: '2xl', md: '3xl'}} mb={2}>
                            <FormattedMessage
                                defaultMessage="Join & save 15% on your first order"
                                id="home.promo.title"
                            />
                        </Heading>
                        <Text fontSize={{base: 'md', md: 'lg'}} opacity={0.9}>
                            <FormattedMessage
                                defaultMessage="Members get early access to sales and new drops."
                                id="home.promo.body"
                            />
                        </Text>
                    </Box>
                    <Button
                        as={Link}
                        to="/registration"
                        bg="white"
                        color="blue.700"
                        size="lg"
                        flexShrink={0}
                        _hover={{bg: 'gray.100', textDecoration: 'none'}}
                    >
                        <FormattedMessage defaultMessage="Create account" id="home.promo.cta" />
                    </Button>
                </Flex>
            </Container>

            {/* Featured products from the lead category */}
            {featuredCategory && (featuredLoading || featured?.hits?.length > 0) && (
                <Section
                    padding={4}
                    paddingTop={4}
                    title={intl.formatMessage(
                        {
                            defaultMessage: 'Featured in {category}',
                            id: 'home.heading.featured'
                        },
                        {category: featuredCategory.name}
                    )}
                    subtitle={intl.formatMessage({
                        defaultMessage: 'Handpicked favourites our shoppers love.',
                        id: 'home.subtitle.featured'
                    })}
                >
                    <Stack pt={8} spacing={16}>
                        <ProductScroller products={featured?.hits} isLoading={featuredLoading} />
                    </Stack>
                </Section>
            )}
        </Box>
    )
}

Home.getTemplateName = () => 'home'

export default Home
