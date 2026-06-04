/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
    Hello there! This is a demonstration of how to override a file from the base template.

    It's necessary that the module export interface remain consistent,
    as other files in the base template rely on constants.js, thus we
    import the underlying constants.js, modifies it and re-export it.
*/

export const CUSTOM_HOME_TITLE = 'New season, new standards'

// Home page merchandising config
export const HOME_HERO_CATEGORY_ID = 'newarrivals'
export const HOME_CATEGORY_SHOWCASE_LIMIT = 6
export const HOME_FEATURED_LIMIT = 12

export * from '@salesforce/retail-react-app/app/constants'
