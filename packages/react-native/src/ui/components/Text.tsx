import { ColorValue } from 'react-native';
// eslint-disable-next-line no-restricted-imports
import { Text as PaperText } from 'react-native-paper';

type TextProps = React.ComponentProps<typeof PaperText> & {
  color?: ColorValue;
  fontSize?: number;
};

export function Text({ children, color, fontSize, style: otherStyle, ...otherProps }: TextProps) {
  let style = {};
  if (color) {
    style = { color };
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
