import { useAppTheme } from '@ralens/react-native';
import Svg, { Path, SvgProps } from 'react-native-svg';
/* SVGR has dropped some elements not supported by react-native-svg: filter */

export const FilmRollImage = ({ height, width, ...props }: SvgProps) => {
  const theme = useAppTheme();
  if (height) {
    width = +height / 0.835;
  } else if (width) {
    height = +width * 0.835;
  }
  return (
    <Svg width={width} height={height} fill="none" viewBox="0 0 236 197" {...props}>
      <Path
        stroke={theme.colors.secondary}
        strokeDasharray="12 12"
        strokeOpacity={0.1}
        strokeWidth={8}
        d="M2 175.16c21.833-7.667 75.7-18.4 116.5 0s94.667 19 116.5 17M2 14.16c21.833-7.667 75.7-18.4 116.5 0s94.667 19 116.5 17"
      />
      <Path
        fill={theme.colors.secondary}
        fillOpacity={0.1}
        fillRule="evenodd"
        d="M2 74h233v107.586l-.225.113-.003-.029c-21.647 1.983-75.012 1.354-115.244-16.789-20.912-9.431-45.033-11.347-66.548-9.991-20.999 1.323-39.733 5.776-50.968 9.62L2 164.492V74ZM114.496 23.344C156.077 41.511 209.255 43.104 235 41.538V74H2V23.386c10.603-3.514 28.903-7.762 49.502-9.02 21.184-1.292 43.897.634 62.994 8.978Z"
        clipRule="evenodd"
      />
    </Svg>
  );
};
