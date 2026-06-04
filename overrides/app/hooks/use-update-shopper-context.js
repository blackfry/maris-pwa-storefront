/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Override: no-op the SCAPI Shopper Context update.
 *
 * The base hook is called unconditionally from the app shell (_app), and on the
 * client it fetches + updates Shopper Context whenever a usid is present. The
 * shared demo SLAS client's guest token does not carry the shopper-context
 * scope, so every page produced a `403 Forbidden` on
 *   /shopper/shopper-context/v1/organizations/<org>/shopper-context/<usid>
 * Shopper Context only drives URL-based personalization (source codes, A/B test
 * assignment, etc.), which this storefront doesn't use — so disabling it removes
 * the failing request with no behavioural change. The base→override resolver
 * redirects _app's import here. Delete this file to restore the live behaviour
 * once the SLAS client has the `sfcc.shopper-context.rw` scope.
 */
export const useUpdateShopperContext = () => {}
