export type Spacing = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const spacingValues: Record<Spacing, number> = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export function spacingValue<T>(spacing?: T | Spacing) {
  if (spacing === 'xs' || spacing === 'sm' || spacing === 'md' || spacing === 'lg' || spacing === 'xl') {
    return spacingValues[spacing as Spacing];
  }
  return spacing;
}
