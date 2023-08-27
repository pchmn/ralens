import { PropsWithChildren } from 'react';
import {
  AnimatableNumericValue,
  DimensionValue,
  FlexAlignType,
  LayoutChangeEvent,
  View,
  ViewStyle,
} from 'react-native';

import { Spacing, spacingValue } from './spacing';

interface FlexProps {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  align?: FlexAlignType;
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  gap?: number | Spacing;
  height?: DimensionValue;
  width?: DimensionValue;
  padding?: DimensionValue | Spacing;
  paddingY?: DimensionValue | Spacing;
  paddingX?: DimensionValue | Spacing;
  backgroundColor?: string;
  flex?: number;
  borderRadius?: AnimatableNumericValue;
  position?: 'absolute' | 'relative';
  style?: ViewStyle;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export function Flex({
  children,
  direction = 'column',
  align,
  justify,
  wrap,
  gap,
  padding,
  paddingX,
  paddingY,
  style,
  onLayout,
  ...otherProps
}: PropsWithChildren<FlexProps>) {
  return (
    <View
      style={{
        display: 'flex',
        flexDirection: direction,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap,
        padding: spacingValue(padding),
        paddingHorizontal: spacingValue(paddingX),
        paddingVertical: spacingValue(paddingY),
        gap: spacingValue(gap),
        ...style,
        ...otherProps,
      }}
      onLayout={onLayout}
    >
      {children}
    </View>
  );
}
