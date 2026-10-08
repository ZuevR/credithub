import { createTheme, type Theme } from '@mui/material/styles';
import { tokens } from '@credithub/design-tokens';

export function createAppTheme(): Theme {
  return createTheme({
    palette: {
      primary: {
        main: tokens.colors.primary.main,
        light: tokens.colors.primary.light,
        dark: tokens.colors.primary.dark,
        contrastText: tokens.colors.primary.contrast,
      },
      secondary: {
        main: tokens.colors.secondary.main,
        light: tokens.colors.secondary.light,
        dark: tokens.colors.secondary.dark,
        contrastText: tokens.colors.secondary.contrast,
      },
      background: {
        default: tokens.colors.surface.muted,
        paper: tokens.colors.surface.default,
      },
      text: {
        primary: tokens.colors.text.primary,
        secondary: tokens.colors.text.secondary,
        disabled: tokens.colors.text.disabled,
      },
    },
    spacing: (factor: number) => factor * tokens.spacing.sm,
    typography: {
      fontFamily: tokens.typography.fontFamily,
      h1: { fontSize: tokens.typography.h1.size, fontWeight: tokens.typography.h1.weight },
      h2: { fontSize: tokens.typography.h2.size, fontWeight: tokens.typography.h2.weight },
      h3: { fontSize: tokens.typography.h3.size, fontWeight: tokens.typography.h3.weight },
      body1: { fontSize: tokens.typography.body.size, fontWeight: tokens.typography.body.weight },
      caption: { fontSize: tokens.typography.caption.size },
    },
    shape: { borderRadius: tokens.shape.borderRadius },
  });
}
