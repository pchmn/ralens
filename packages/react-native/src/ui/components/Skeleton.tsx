import { PropsWithChildren } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '../UiProvider';

interface SkeletonProps {
  children?: React.ReactNode;
  style?: StyleProp<Animated.AnimateStyle<StyleProp<ViewStyle>>>;
  height?: number;
  width?: number;
  borderRadius?: number;
}

export function Skeleton({ children, height, width, borderRadius = 8, style }: PropsWithChildren<SkeletonProps>) {
  const theme = useAppTheme();

  const progress = useSharedValue(0);

  progress.value = withRepeat(
    withTiming(1, {
      duration: 400,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }),
    Infinity,
    true
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        [theme.colors.surfaceContainerHighest, theme.colors.surfaceContainerHigh]
      ),
    };
  });

  return <Animated.View style={[style, { height, width, borderRadius }, animatedStyle]}>{children}</Animated.View>;
}
