/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#242424',
    tint: '#7A1F2B',

    // Core surfaces
    background: '#FAFAFA',
    foreground: '#242424',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#242424',

    // Primary action color (buttons, links, active states)
    primary: '#7A1F2B',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#F3F3F3',
    secondaryForeground: '#3A3A3A',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#F3F3F3',
    mutedForeground: '#777777',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#EEE2E3',
    accentForeground: '#7A1F2B',

    // Destructive actions (delete, error states)
    destructive: '#B42318',
    destructiveForeground: '#FFFFFF',
    success: '#287A52',
    successSurface: '#EAF5EF',
    warningSurface: '#FCEDEC',
    overlay: '#242424B8',

    // Borders and input outlines
    border: '#E7E4E4',
    input: '#D7D1D1',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
