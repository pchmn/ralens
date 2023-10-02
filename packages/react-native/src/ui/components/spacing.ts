export type Spacing = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';

const spacingValues: Record<Spacing, number> = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};
export function spacingValue(spacing: Spacing): number;
export function spacingValue<T>(spacing?: T | Spacing): T | number | undefined;
export function spacingValue<T>(spacing?: T | Spacing) {
  if (
    spacing === 'xs' ||
    spacing === 'sm' ||
    spacing === 'md' ||
    spacing === 'lg' ||
    spacing === 'xl' ||
    spacing === 'xxl' ||
    spacing === 'xxxl'
  ) {
    return spacingValues[spacing as Spacing];
  }
  return spacing;
}
