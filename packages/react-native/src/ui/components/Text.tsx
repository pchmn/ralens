import { ColorValue, StyleProp, TextStyle } from 'react-native';
// eslint-disable-next-line no-restricted-imports
import { Text as PaperText } from 'react-native-paper';

type TextProps = React.ComponentProps<typeof PaperText> & {
  color?: ColorValue;
  fontSize?: number;
  textAlign?: 'center' | 'auto' | 'left' | 'right' | 'justify';
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  uppercase?: boolean;
};

export function Text({
  children,
  color,
  fontSize,
  textAlign,
  fontWeight,
  style: otherStyle,
  uppercase,
  ...otherProps
}: TextProps) {
  let style: Partial<StyleProp<TextStyle>> = {
    textAlign,
    fontWeight,
    textTransform: uppercase ? 'uppercase' : undefined,
  };
  if (color) {
    style = { ...style, color };
  }
  if (fontSize) {
    style = { ...style, fontSize };
  }
  return (
    <PaperText style={[style, otherStyle]} {...otherProps}>
      {children}
    </PaperText>
  );
}
