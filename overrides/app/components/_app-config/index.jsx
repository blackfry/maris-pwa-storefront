/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React from 'react'
import PropTypes from 'prop-types'
import loadable from '@loadable/component'
import {Helmet} from 'react-helmet'
import {ChakraProvider} from '@salesforce/retail-react-app/app/components/shared/ui'

// Removes focus for non-keyboard interactions for the whole application
import 'focus-visible/dist/focus-visible'

// Import OUR brand theme by RELATIVE path. Under Template Extensibility the
// overrides resolver only redirects base->override (never override->override),
// so importing '@salesforce/retail-react-app/app/theme' from this overrides file
// would resolve to the BASE theme. A relative import bypasses the resolver and
// applies the Maris brand theme app-wide via <ChakraProvider theme={theme}>.
import theme from '../../theme'
import {MultiSiteProvider, StoreLocatorProvider} from '@salesforce/retail-react-app/app/contexts'
import {
    resolveSiteFromUrl,
    resolveLocaleFromUrl
} from '@salesforce/retail-react-app/app/utils/site-utils'
import {getConfig} from '@salesforce/pwa-kit-runtime/utils/ssr-config'
import {
    getEnvBasePath,
    slasPrivateProxyPath,
    slasPublicProxyPath
} from '@salesforce/pwa-kit-runtime/utils/ssr-namespace-paths'
import {createUrlTemplate} from '@salesforce/retail-react-app/app/utils/url'
import createLogger from '@salesforce/pwa-kit-runtime/utils/logger-factory'
import {getPasswordlessCallbackUrl} from '@salesforce/retail-react-app/app/utils/auth-utils'

import {CommerceApiProvider} from '@salesforce/commerce-sdk-react'
import {withReactQuery} from '@salesforce/pwa-kit-react-sdk/ssr/universal/components/with-react-query'
import {useCorrelationId} from '@salesforce/pwa-kit-react-sdk/ssr/universal/hooks'
import {getAppOrigin} from '@salesforce/pwa-kit-react-sdk/utils/url'
import {generateSfdcUserAgent} from '@salesforce/retail-react-app/app/utils/sfdc-user-agent-utils'
import {
    DEFAULT_DNT_STATE,
    STORE_LOCATOR_RADIUS,
    STORE_LOCATOR_RADIUS_UNIT,
    STORE_LOCATOR_DEFAULT_COUNTRY,
    STORE_LOCATOR_DEFAULT_COUNTRY_CODE,
    STORE_LOCATOR_DEFAULT_POSTAL_CODE,
    STORE_LOCATOR_DEFAULT_PAGE_SIZE,
    STORE_LOCATOR_SUPPORTED_COUNTRIES
} from '@salesforce/retail-react-app/app/constants'

const sfdcUserAgent = generateSfdcUserAgent()

// React Query devtools are a development-only aid. The stock _app-config
// imports them statically and renders them unconditionally; webpack strips the
// package to a no-op shim in production, but it still bloats the *development*
// bundle (which is what Lighthouse measures locally). Loading them lazily and
// only outside production keeps them out of the eager bundle entirely: in
// production this resolves to a render-nothing component (so the dynamic import
// is dead-code-eliminated), and in development they load as a separate async
// chunk rather than riding along in main/vendor.
const ReactQueryDevtools =
    process.env.NODE_ENV !== 'production'
        ? loadable(() =>
              import('@tanstack/react-query-devtools').then((module) => ({
                  default: module.ReactQueryDevtools
              }))
          )
        : () => null

/**
 * Use the AppConfig component to inject extra arguments into the getProps
 * methods for all Route Components in the app – typically you'd want to do this
 * to inject a connector instance that can be used in all Pages.
 *
 * You can also use the AppConfig to configure a state-management library such
 * as Redux, or Mobx, if you like.
 */
const AppConfig = ({children, locals = {}}) => {
    const {correlationId} = useCorrelationId()
    const headers = {
        'correlation-id': correlationId,
        sfdc_user_agent: sfdcUserAgent,
        'x-site-id': locals.site?.id
    }

    const commerceApiConfig = locals.appConfig.commerceAPI

    const appOrigin = getAppOrigin()
    const passwordlessCallbackURI = getPasswordlessCallbackUrl(
        locals.appConfig.login?.passwordless?.callbackURI
    )

    const storeLocatorConfig = {
        radius: STORE_LOCATOR_RADIUS,
        radiusUnit: STORE_LOCATOR_RADIUS_UNIT,
        defaultCountry: STORE_LOCATOR_DEFAULT_COUNTRY,
        defaultCountryCode: STORE_LOCATOR_DEFAULT_COUNTRY_CODE,
        defaultPostalCode: STORE_LOCATOR_DEFAULT_POSTAL_CODE,
        defaultPageSize: STORE_LOCATOR_DEFAULT_PAGE_SIZE,
        supportedCountries: STORE_LOCATOR_SUPPORTED_COUNTRIES
    }

    // Set absolute uris for CommerceApiProvider proxies and callbacks
    const redirectURI = `${appOrigin}${getEnvBasePath()}/callback`
    const proxy = `${appOrigin}${getEnvBasePath()}${commerceApiConfig.proxyPath}`
    const slasPrivateClientProxyEndpoint = `${appOrigin}${getEnvBasePath()}${slasPrivateProxyPath}`
    const slasPublicClientProxyEndpoint = `${appOrigin}${getEnvBasePath()}${slasPublicProxyPath}`

    return (
        <CommerceApiProvider
            shortCode={commerceApiConfig.parameters.shortCode}
            clientId={commerceApiConfig.parameters.clientId}
            organizationId={commerceApiConfig.parameters.organizationId}
            siteId={locals.site?.id}
            locale={locals.locale?.id}
            currency={locals.locale?.preferredCurrency}
            redirectURI={redirectURI}
            proxy={proxy}
            headers={headers}
            defaultDnt={DEFAULT_DNT_STATE}
            logger={createLogger({packageName: 'commerce-sdk-react'})}
            passwordlessLoginCallbackURI={passwordlessCallbackURI}
            // Set 'enablePWAKitPrivateClient' to true to use SLAS private client login flows.
            // Make sure to also enable useSLASPrivateClient in ssr.js when enabling this setting.
            enablePWAKitPrivateClient={false}
            privateClientProxyEndpoint={slasPrivateClientProxyEndpoint}
            publicClientProxyEndpoint={slasPublicClientProxyEndpoint}
            cookieDomain={commerceApiConfig.cookieDomain}
            // Uncomment 'hybridAuthEnabled' if the current site has Hybrid Auth enabled. Do NOT set this flag for hybrid storefronts using Plugin SLAS.
            // hybridAuthEnabled={true}
            enableHttpOnlySessionCookies={
                typeof window !== 'undefined'
                    ? window.__MRT_ENABLE_HTTPONLY_SESSION_COOKIES__ === 'true'
                    : process.env.MRT_ENABLE_HTTPONLY_SESSION_COOKIES === 'true'
            }
        >
            {/* Maris brand: load the Fraunces display serif used for headings.
                font-display:swap avoids invisible text / layout shift during load. */}
            <Helmet>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&display=swap"
                />
            </Helmet>
            <MultiSiteProvider site={locals.site} locale={locals.locale} buildUrl={locals.buildUrl}>
                <StoreLocatorProvider config={storeLocatorConfig}>
                    <ChakraProvider theme={theme}>{children}</ChakraProvider>
                </StoreLocatorProvider>
            </MultiSiteProvider>
            <ReactQueryDevtools />
        </CommerceApiProvider>
    )
}

AppConfig.restore = (locals = {}) => {
    const path =
        typeof window === 'undefined'
            ? locals.originalUrl
            : `${window.location.pathname}${window.location.search}`
    const site = resolveSiteFromUrl(path)
    const locale = resolveLocaleFromUrl(path)

    const {app: appConfig} = getConfig()
    const apiConfig = {
        ...appConfig.commerceAPI,
        einsteinConfig: appConfig.einsteinAPI
    }

    apiConfig.parameters.siteId = site.id

    locals.buildUrl = createUrlTemplate(appConfig, site.alias || site.id, locale.id)
    locals.site = site
    locals.locale = locale
    locals.appConfig = appConfig
}

AppConfig.freeze = () => undefined

AppConfig.extraGetPropsArgs = (locals = {}) => {
    return {
        buildUrl: locals.buildUrl,
        site: locals.site,
        locale: locals.locale
    }
}

AppConfig.propTypes = {
    children: PropTypes.node,
    locals: PropTypes.object
}

const isServerSide = typeof window === 'undefined'

// Recommended settings for PWA-Kit usages.
// NOTE: they will be applied on both server and client side.
// retry is always disabled on server side regardless of the value from the options
const options = {
    queryClientConfig: {
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
                staleTime: 10 * 1000,
                ...(isServerSide ? {retryOnMount: false} : {})
            },
            mutations: {
                retry: false
            }
        }
    }
}

export default withReactQuery(AppConfig, options)
