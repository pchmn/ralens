import { useEffectOnce } from '@ralens/react-native';
import { ReactNode } from 'react';
import { BackHandler, StyleProp, ViewStyle } from 'react-native';
import { Portal } from 'react-native-paper';
import Animated, { Keyframe } from 'react-native-reanimated';
import { BaseAnimationBuilder, EntryExitAnimationFunction } from 'react-native-reanimated';

export function Modal({
  visible,
  children,
  enteringAnimation,
  exitingAnimation,
  containerStyle,
  onDismiss,
  fullScreen,
}: {
  children: ReactNode;
  visible: boolean;
  enteringAnimation?: BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction | Keyframe;
  exitingAnimation?: BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction | Keyframe;
  containerStyle?: StyleProp<Animated.AnimateStyle<StyleProp<ViewStyle>>>;
  fullScreen?: boolean;
  onDismiss?: () => void;
}) {
  useEffectOnce(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onDismiss) {
        onDismiss();
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  });

  return (
    <Portal>
      {visible && (
        <Animated.View
          entering={enteringAnimation}
          exiting={exitingAnimation}
          style={[fullScreen ? { flex: 1 } : undefined, containerStyle]}
        >
          {children}
        </Animated.View>
      )}
    </Portal>
  );
}
