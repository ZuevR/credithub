import { colors } from './colors';
import { shape } from './shape';
import { spacing } from './spacing';
import { typography } from './typography';

export const tokens = { colors, spacing, typography, shape } as const;
export type DesignTokens = typeof tokens;
