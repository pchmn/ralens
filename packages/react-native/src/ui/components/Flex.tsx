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
  p?: DimensionValue | Spacing;
  py?: DimensionValue | Spacing;
  px?: DimensionValue | Spacing;
  pr?: DimensionValue | Spacing;
  pl?: DimensionValue | Spacing;
  pt?: DimensionValue | Spacing;
  pb?: DimensionValue | Spacing;
  m?: DimensionValue | Spacing;
  my?: DimensionValue | Spacing;
  mx?: DimensionValue | Spacing;
  mr?: DimensionValue | Spacing;
  ml?: DimensionValue | Spacing;
  bgColor?: string;
  flex?: number;
  borderRadius?: AnimatableNumericValue;
  position?: 'absolute' | 'relative';
  display?: 'flex' | 'none';
  alignSelf?: 'auto' | FlexAlignType;
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
  p,
  px,
  py,
  pr,
  pl,
  pt,
  pb,
  m,
  mx,
  my,
  mr,
  ml,
  bgColor,
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
        padding: spacingValue(p),
        paddingHorizontal: spacingValue(px),
        paddingVertical: spacingValue(py),
        paddingRight: spacingValue(pr),
        paddingLeft: spacingValue(pl),
        paddingTop: spacingValue(pt),
        paddingBottom: spacingValue(pb),
        margin: spacingValue(m),
        marginHorizontal: spacingValue(mx),
        marginVertical: spacingValue(my),
        marginRight: spacingValue(mr),
        marginLeft: spacingValue(ml),
        backgroundColor: bgColor,
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
