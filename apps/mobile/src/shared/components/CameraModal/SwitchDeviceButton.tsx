import { TouchableRipple } from 'react-native-paper';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SwitchIcon } from '../icons';

export function SwitchDeviceButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const rotation = useSharedValue(0);
  const timingRotation = useDerivedValue(() => withTiming(rotation.value, { duration: 200 }));
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${timingRotation.value}deg` }],
  }));

  return (
    <TouchableRipple
      onPress={() => {
        onPress();
        rotation.value = rotation.value + 180;
      }}
      borderless
      disabled={disabled}
      style={{
        borderRadius: 40,
        borderColor: '#ffffff1A',
        padding: 8,
        borderWidth: 1,
        backgroundColor: '#00000033',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View style={animatedStyle} entering={FadeInDown.duration(200)}>
        <SwitchIcon color="#fff" size={28} />
      </Animated.View>
    </TouchableRipple>
  );
}
