/*
 * "Maris" brand design tokens.
 *
 * These are the per-client tokens an agency would define when rebranding the
 * Retail React App starter. They are consumed by overrides/app/theme/index.js,
 * which layers them on top of the base @salesforce/retail-react-app theme.
 *
 * Maris = a premium coastal apparel label: deep ocean teal primary, warm coral
 * accent, sandy off-white surfaces, a display serif for headings.
 */

// ----- Colour scales (Chakra 50–900 convention) -----
export const brandColors = {
    // Primary — deep ocean teal. `brand.600` is the default action colour.
    brand: {
        50: '#ECF6F6',
        100: '#CFE8E8',
        200: '#9FD1D1',
        300: '#63B4B5',
        400: '#2E9698',
        500: '#117C7E',
        600: '#0C6364',
        700: '#0A4F50',
        800: '#073C3D',
        900: '#042828'
    },
    // Accent — warm coral, for sale badges / secondary CTAs.
    accent: {
        50: '#FDF1EC',
        100: '#FADCD0',
        200: '#F4B7A1',
        300: '#EC8F70',
        400: '#E46E4D',
        500: '#D85636',
        600: '#BF4327',
        700: '#99351F',
        800: '#722819',
        900: '#4D1B11'
    },
    // Warm neutral surfaces.
    sand: {
        50: '#FAF8F4',
        100: '#F2ECE2',
        200: '#E6DBC9',
        300: '#D6C6AB',
        400: '#C2AC86',
        500: '#A98F63',
        600: '#8A7149',
        700: '#6A5637',
        800: '#4A3C26',
        900: '#2C2316'
    },
    // Brand-tinted near-black for body text.
    ink: '#13211F'
}

// ----- Typography -----
// Fraunces (a characterful variable serif) is loaded via <Helmet> in
// overrides/app/components/_app-config/index.jsx with font-display:swap.
// Body stays on the system sans stack to avoid a second web-font request.
export const brandFonts = {
    heading: `'Fraunces', Georgia, 'Times New Roman', serif`,
    body: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
}

// ----- Radii (softer than the starter for a premium feel) -----
export const brandRadii = {
    sm: '0.25rem',
    base: '0.5rem',
    md: '0.625rem',
    lg: '0.875rem',
    xl: '1.125rem'
}

// ----- Spacing (preserve the base custom `11`, add named brand tokens) -----
export const brandSpace = {
    11: '2.75rem',
    13: '3.25rem',
    18: '4.5rem',
    gutter: '1.5rem',
    section: '5rem'
}

// ----- Global page styles -----
export const brandStyles = {
    global: {
        'html, body': {
            backgroundColor: 'sand.50',
            color: 'ink',
            fontFamily: 'body'
        }
    }
}

// ----- Component theme overrides that wire components to the brand tokens -----
export const brandComponents = {
    Button: {
        baseStyle: {
            borderRadius: 'base',
            fontWeight: 'semibold',
            letterSpacing: '0.01em'
        },
        // The starter's default colorScheme is 'blue'; we make 'brand' the default
        // and also map the starter's existing 'blue' buttons onto the brand colour
        // so pages we never touched pick up the rebrand.
        defaultProps: {colorScheme: 'brand'},
        variants: {
            solid: (props) => {
                if (props.colorScheme === 'brand' || props.colorScheme === 'blue') {
                    return {
                        backgroundColor: 'brand.600',
                        color: 'white',
                        _hover: {bg: 'brand.700', _disabled: {bg: 'brand.200'}},
                        _active: {bg: 'brand.800'},
                        _disabled: {bg: 'brand.200'}
                    }
                }
                if (props.colorScheme === 'accent') {
                    return {
                        backgroundColor: 'accent.500',
                        color: 'white',
                        _hover: {bg: 'accent.600'},
                        _active: {bg: 'accent.700'}
                    }
                }
                return {}
            },
            outline: (props) =>
                props.colorScheme === 'black'
                    ? {
                          color: 'ink',
                          borderColor: 'brand.600',
                          borderWidth: '1px',
                          _hover: {bg: 'sand.100'}
                      }
                    : {color: 'brand.700', borderColor: 'brand.600', _hover: {bg: 'sand.100'}}
        }
    },
    Heading: {
        baseStyle: {
            fontFamily: 'heading',
            letterSpacing: '-0.01em'
        }
    }
}
