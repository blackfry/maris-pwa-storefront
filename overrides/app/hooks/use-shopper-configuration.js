/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Override: no-op the SCAPI Shopper Configurations lookup.
 *
 * The base hook queries ShopperConfigurations (useConfigurations) and is reached
 * on every page through use-sf-payments → useSFPaymentsEnabled, which calls it
 * regardless of the local `app.sfPayments.enabled` flag ("let the API decide").
 * The shared demo guest token isn't permitted for that API, so it returned a
 * `403 Forbidden` on
 *   /configuration/shopper-configurations/v1/organizations/<org>/configurations
 * Salesforce Payments is disabled for this storefront (app.sfPayments.enabled =
 * false), so returning undefined for every configuration id is the correct
 * result and avoids the failing request. The base→override resolver redirects
 * use-sf-payments' import here. Delete this file to restore the live lookup.
 */
export const useShopperConfiguration = () => undefined
