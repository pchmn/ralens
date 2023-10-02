import { PropsWithChildren } from 'react';
import { AnimatableNumericValue, DimensionValue, FlexAlignType } from 'react-native';
import { TouchableRipple, TouchableRippleProps } from 'react-native-paper';

import { Spacing, spacingValue } from './spacing';

interface FlexTouchableRippleProps extends TouchableRippleProps {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  align?: FlexAlignType;
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  gap?: number | Spacing;
  h?: DimensionValue;
  w?: DimensionValue;
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
  mt?: DimensionValue | Spacing;
  mb?: DimensionValue | Spacing;
  bgColor?: string;
  flex?: number;
  flexShrink?: number;
  borderRadius?: AnimatableNumericValue;
  position?: 'absolute' | 'relative';
  display?: 'flex' | 'none';
  alignSelf?: 'auto' | FlexAlignType;
}

export function FlexTouchableRipple({
  children,
  direction = 'column',
  align,
  justify,
  wrap,
  gap,
  h,
  w,
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
  mt,
  mb,
  bgColor,
  style,
  flex,
  borderRadius,
  position,
  display,
  alignSelf,
  flexShrink = 1,
  ...otherProps
}: PropsWithChildren<FlexTouchableRippleProps>) {
  return (
    <TouchableRipple
      style={[
        {
          display: display || 'flex',
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
          marginTop: spacingValue(mt),
          marginBottom: spacingValue(mb),
          backgroundColor: bgColor,
          gap: spacingValue(gap),
          flexShrink,
          height: h,
          width: w,
          flex,
          borderRadius,
          position,
          alignSelf,
        },
        style,
      ]}
      {...otherProps}
    >
      {children}
    </TouchableRipple>
  );
}
