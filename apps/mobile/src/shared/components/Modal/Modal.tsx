import { useEffectOnce } from '@ralens/react-native';
import { ReactNode } from 'react';
import { BackHandler, StyleProp, ViewStyle } from 'react-native';
import { Portal } from 'react-native-paper';
import Animated, { Keyframe } from 'react-native-reanimated';
import { BaseAnimationBuilder, EntryExitAnimationFunction } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Modal({
  visible,
  children,
  enteringAnimation,
  exitingAnimation,
  containerStyle,
  onDismiss,
  fullScreen,
  insetsPadding,
  bgColor,
}: {
  children: ReactNode;
  visible: boolean;
  enteringAnimation?: BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction | Keyframe;
  exitingAnimation?: BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction | Keyframe;
  containerStyle?: StyleProp<Animated.AnimateStyle<StyleProp<ViewStyle>>>;
  fullScreen?: boolean;
  onDismiss?: () => void;
  insetsPadding?: boolean;
  bgColor?: string;
}) {
  const { top, bottom } = useSafeAreaInsets();

  const style = {
    flex: fullScreen ? 1 : undefined,
    paddingTop: insetsPadding ? top : undefined,
    paddingBottom: insetsPadding ? bottom : undefined,
    backgroundColor: bgColor,
  };

  useEffectOnce(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible && onDismiss) {
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
        <Animated.View entering={enteringAnimation} exiting={exitingAnimation} style={[style, containerStyle]}>
          {children}
        </Animated.View>
      )}
    </Portal>
  );
}
