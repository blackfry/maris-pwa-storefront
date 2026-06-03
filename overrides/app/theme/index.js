/*
 * Maris theme entry point.
 *
 * Under PWA Kit Template Extensibility, every consumer that imports
 * `@salesforce/retail-react-app/app/theme` (including _app-config's
 * <ChakraProvider theme={theme}>) resolves to THIS file because it exists under
 * overrides/. We import the base theme's `overrides` object via the same
 * specifier — the extensibility resolver gives an override file the BASE module
 * when it imports its own path — then layer the Maris brand tokens on top with
 * extendTheme. This is "extend, don't fork": we inherit every component style
 * the starter ships and only override what the brand changes.
 */
import {extendTheme} from '@salesforce/retail-react-app/app/components/shared/ui'
import {overrides as base} from '@salesforce/retail-react-app/app/theme'
import {
    brandColors,
    brandFonts,
    brandRadii,
    brandSpace,
    brandStyles,
    brandComponents
} from './foundations/brand'

// Re-export the (base) overrides object for parity with the base theme module,
// in case other code imports the named `overrides` export.
export const overrides = base

export default extendTheme(base, {
    colors: brandColors,
    fonts: brandFonts,
    radii: brandRadii,
    space: brandSpace,
    styles: brandStyles,
    components: brandComponents
})
