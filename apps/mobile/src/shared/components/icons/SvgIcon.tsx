import { Svg, SvgProps } from 'react-native-svg';

export interface SvgIconProps extends SvgProps {
  size?: number;
  type?: 'outline' | 'filled';
}

export function SvgIcon({ size = 24, type = 'filled', children, ...props }: SvgIconProps) {
  return (
    <Svg
      {...props}
      fill={type === 'filled' ? 'currentColor' : undefined}
      stroke={type === 'outline' ? 'currentColor' : undefined}
      width={size}
      height={size}
    >
      {children}
    </Svg>
  );
}
