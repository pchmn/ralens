import { TouchableScale, useAppTheme } from '@ralens/react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { CaptureMode } from './CaptureModeCarousel';

export function CaptureButton({
  onPress,
  onLongPress,
  disabled,
  mode,
  isRecording,
}: {
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  mode: CaptureMode;
  isRecording?: boolean;
}) {
  const theme = useAppTheme();

  const [pressed, setPressed] = useState(false);

  const size = useDerivedValue(() => {
    return withTiming(mode === 'photo' && !isRecording ? 1 : 0, { duration: 200 });
  });

  const animatedBorderRadius = useDerivedValue(() => {
    return withTiming(isRecording ? 0 : 1, { duration: 200 });
  });

  const animatedStyle = useAnimatedStyle(() => {
    const height = interpolate(size.value, [0, 1], [0.3, 1]);
    const width = interpolate(size.value, [0, 1], [0.3, 1]);
    const borderRadius = interpolate(animatedBorderRadius.value, [0, 1], [3, 35]);

    return {
      backgroundColor: pressed && !isRecording ? theme.colors.tertiary : '#fff',
      height: `${Math.floor(100 * height)}%`,
      width: `${Math.floor(100 * width)}%`,
      borderRadius,
    };
  });

  return (
    <TouchableScale
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        borderRadius: 70,
        borderColor: '#ffffff80',
        backgroundColor: isRecording ? '#FF6961' : '#00000033',
        borderWidth: 6,
        opacity: disabled ? 0.5 : 1,
        height: 70,
        width: 70,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onLongPress={onLongPress}
      disabled={disabled}
    >
      <Animated.View style={animatedStyle}>
        <View />
      </Animated.View>
    </TouchableScale>
  );
}
