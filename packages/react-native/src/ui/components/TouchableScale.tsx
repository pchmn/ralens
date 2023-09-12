import { TouchableWithoutFeedback } from 'react-native';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export function TouchableScale({
  onPress,
  onPressIn,
  onPressOut,
  style,
  children,
  ...props
}: TouchableWithoutFeedback['props']) {
  const pressed = useSharedValue(false);
  const progress = useDerivedValue(() => {
    return pressed.value ? withTiming(1, { duration: 100 }) : withTiming(0, { duration: 100 });
  });
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 1.2], Extrapolate.CLAMP);

    return {
      transform: [{ scale }],
    };
  });

  return (
    <TouchableWithoutFeedback
      onPressIn={(e) => {
        pressed.value = true;
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = false;
        onPressOut?.(e);
      }}
      onPress={onPress}
      {...props}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </TouchableWithoutFeedback>
  );
}
