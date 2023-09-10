import { TouchableRipple } from 'react-native-paper';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { FlashAutoIcon, FlashOffIcon, FlashOnIcon } from '../icons';
import { FlashMode } from './useCamera';

export function SwitchFlashModeButton({
  value,
  disabled,
  onChange,
}: {
  value: FlashMode;
  disabled?: boolean;
  onChange: (value: FlashMode) => void;
}) {
  return (
    <TouchableRipple
      onPress={() => {
        switch (value) {
          case 'on':
            onChange('auto');
            break;
          case 'off':
            onChange('on');
            break;
          case 'auto':
            onChange('off');
            break;
        }
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
      <Animated.View key={value} entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(200)}>
        {value === 'on' ? (
          <FlashOnIcon color="#fff" size={28} />
        ) : value === 'off' ? (
          <FlashOffIcon color="#fff" size={28} />
        ) : (
          <FlashAutoIcon color="#fff" size={28} />
        )}
      </Animated.View>
    </TouchableRipple>
  );
}
