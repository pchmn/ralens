import { useAppTheme } from '@ralens/react-native';
import Svg, { Circle, Path, Rect, SvgProps } from 'react-native-svg';
/* SVGR has dropped some elements not supported by react-native-svg: filter */

export const CameraImage = ({ height = 250, width = 250, ...props }: SvgProps) => {
  const theme = useAppTheme();
  return (
    <Svg width={width} height={height} fill="none" viewBox="0 0 250 250" {...props}>
      <Rect
        width={250}
        height={250}
        fill={theme.dark ? theme.colors.secondaryContainer : theme.colors.primary}
        fillOpacity={theme.dark ? undefined : 0.6}
        rx={40}
      />
      <Path
        fill="#fff"
        fillOpacity={theme.dark ? 0.05 : 0.1}
        d="M0 125h250v85c0 22.091-17.909 40-40 40H40c-22.091 0-40-17.909-40-40v-85Z"
      />
      <Circle
        cx={124.5}
        cy={124.5}
        r={70.5}
        stroke={theme.dark ? theme.colors.onSecondaryContainer : theme.colors.onSecondary}
        strokeWidth={30}
      />
      <Path
        fill="#000"
        fillOpacity={theme.dark ? 0.2 : 0.1}
        fillRule="evenodd"
        d="M124.5 209c46.048 0 83.594-36.403 85.43-82 .046 1.161.07 2.328.07 3.5 0 47.22-38.28 85.5-85.5 85.5S39 177.72 39 130.5c0-1.172.024-2.339.07-3.5 1.836 45.597 39.382 82 85.43 82Z"
        clipRule="evenodd"
      />
      <Circle
        cx={124.5}
        cy={124.5}
        r={55.5}
        fill={theme.dark ? theme.colors.background : theme.colors.onBackground}
        fillOpacity={theme.dark ? 0.5 : 0.7}
      />
      <Circle
        cx={124.5}
        cy={124.5}
        r={35.5}
        fill={theme.dark ? theme.colors.background : theme.colors.onBackground}
        fillOpacity={theme.dark ? 0.4 : 0.4}
      />
      <Circle
        cx={124.5}
        cy={124.5}
        r={20.5}
        fill={theme.dark ? theme.colors.background : theme.colors.onBackground}
        fillOpacity={theme.dark ? 0.4 : 0.4}
      />
      <Circle cx={124.5} cy={118.5} r={4.5} fill="#fff" fillOpacity={0.2} />
      <Circle cx={124.5} cy={129.5} r={2.5} fill="#fff" fillOpacity={0.2} />
      <Circle cx={38.5} cy={34.5} r={9.5} fill={theme.dark ? theme.colors.tertiary : theme.colors.tertiaryContainer} />
    </Svg>
  );
};
