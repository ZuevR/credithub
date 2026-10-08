import { colors } from './colors';
import { shape } from './shape';
import { spacing } from './spacing';
import { typography } from './typography';

/**
 * The design tokens as CSS custom properties.
 *
 * This is the one format both stacks can consume without sharing a runtime: the
 * React shell builds its MUI theme from the token objects, while the Angular
 * remote (and anything else, including plain CSS) reads these variables. Both
 * therefore resolve to the same `libs/design-tokens` values.
 *
 * Names are the token paths in kebab-case: `colors.surface.default` ->
 * `--ch-color-surface-default`. Flat numeric tokens (spacing, font sizes and
 * weights, radius) are expanded into one variable each.
 */
export const cssVariables = {
  // colors.*
  '--ch-color-primary-main': colors.primary.main,
  '--ch-color-primary-light': colors.primary.light,
  '--ch-color-primary-dark': colors.primary.dark,
  '--ch-color-primary-contrast': colors.primary.contrast,
  '--ch-color-secondary-main': colors.secondary.main,
  '--ch-color-secondary-light': colors.secondary.light,
  '--ch-color-secondary-dark': colors.secondary.dark,
  '--ch-color-secondary-contrast': colors.secondary.contrast,
  '--ch-color-surface-default': colors.surface.default,
  '--ch-color-surface-muted': colors.surface.muted,
  '--ch-color-surface-elevated': colors.surface.elevated,
  '--ch-color-text-primary': colors.text.primary,
  '--ch-color-text-secondary': colors.text.secondary,
  '--ch-color-text-disabled': colors.text.disabled,
  '--ch-color-text-inverse': colors.text.inverse,
  '--ch-color-status-success': colors.status.success,
  '--ch-color-status-warning': colors.status.warning,
  '--ch-color-status-error': colors.status.error,
  '--ch-color-status-info': colors.status.info,

  // spacing.*
  '--ch-spacing-xs': `${spacing.xs}px`,
  '--ch-spacing-sm': `${spacing.sm}px`,
  '--ch-spacing-md': `${spacing.md}px`,
  '--ch-spacing-lg': `${spacing.lg}px`,
  '--ch-spacing-xl': `${spacing.xl}px`,
  '--ch-spacing-xxl': `${spacing.xxl}px`,

  // typography.*
  '--ch-font-family': typography.fontFamily,
  '--ch-font-size-h1': `${typography.h1.size}px`,
  '--ch-font-weight-h1': `${typography.h1.weight}`,
  '--ch-font-size-h2': `${typography.h2.size}px`,
  '--ch-font-weight-h2': `${typography.h2.weight}`,
  '--ch-font-size-h3': `${typography.h3.size}px`,
  '--ch-font-weight-h3': `${typography.h3.weight}`,
  '--ch-font-size-body': `${typography.body.size}px`,
  '--ch-font-weight-body': `${typography.body.weight}`,
  '--ch-font-line-height-body': `${typography.body.lineHeight}`,
  '--ch-font-size-caption': `${typography.caption.size}px`,

  // shape.*
  '--ch-shape-radius': `${shape.borderRadius}px`,
} as const;

export type CssVariables = typeof cssVariables;

/** The variables as a `:root { … }` block, ready to inject into the document. */
export function cssVariablesToCss(selector = ':root'): string {
  const declarations = Object.entries(cssVariables)
    .map(([name, value]) => `${name}: ${value};`)
    .join('');
  return `${selector}{${declarations}}`;
}

/** Shorthand for the default `:root` block. */
export const cssVariablesCss = cssVariablesToCss();
