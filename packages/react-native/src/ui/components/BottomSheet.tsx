import * as NavigationBar from 'expo-navigation-bar';
import React, { useCallback, useImperativeHandle, useMemo } from 'react';
import { BackHandler, Dimensions, Platform, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEffectOnce } from '../../core';
import { useAppTheme } from '../UiProvider';
import { shadow } from '../utils';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHADOW_DISTANCE = 5;
const INDICATOR_HEIGHT = 36;

type BottomSheetProps = {
  children?: React.ReactNode;
  containerStyle?: ViewStyle;
  indicatorStyle?: ViewStyle;
  onIndexChange?: (index: number, positionY: number) => void;
  positionValue?: SharedValue<number>;
  snapPoint?: number;
};

export type BottomSheetRefProps = {
  snapToPosition: (destination: number) => void;
  snapToIndex: (index: number) => void;
  toggle: () => void;
  open: () => void;
  close: () => void;
};

// eslint-disable-next-line react/display-name
export const BottomSheet = React.forwardRef<BottomSheetRefProps, BottomSheetProps>(
  ({ children, containerStyle, indicatorStyle, onIndexChange, positionValue, snapPoint }, ref) => {
    const insets = useSafeAreaInsets();
    const frame = useSafeAreaFrame();

    const theme = useAppTheme();

    const animatedRef = useAnimatedRef<Animated.View>();

    const snapPoints = useMemo(
      () => [
        insets.top + SHADOW_DISTANCE,
        snapPoint ? -snapPoint - INDICATOR_HEIGHT : -SCREEN_HEIGHT * 0.45,
        -frame.height,
      ],
      [frame.height, insets.top, snapPoint]
    );

    const translateY = useSharedValue(insets.top + 5);
    const index = useSharedValue(0);
    const active = useSharedValue(false);

    const distanceBetween = (positionA: number, positionB: number) => {
      'worklet';
      return Math.abs(positionA - positionB);
    };

    const snapToPosition = useCallback(
      (destination: number) => {
        'worklet';
        active.value = destination < snapPoints[0];
        if (Platform.OS === 'android') {
          if (destination < snapPoints[0]) {
            runOnJS(NavigationBar.setBackgroundColorAsync)(theme.colors.surfaceContainerLow);
          } else {
            runOnJS(NavigationBar.setBackgroundColorAsync)(theme.colors.surfaceContainer);
          }
        }
        const newIndex = snapPoints.findIndex((snapPoint) => snapPoint === destination);
        if (newIndex !== -1) {
          index.value = newIndex;
        }
        translateY.value = withSpring(destination, { damping: 20, stiffness: 150, mass: 0.1 });
      },
      [active, index, snapPoints, theme.colors.surfaceContainer, theme.colors.surfaceContainerLow, translateY]
    );

    const snapToIndex = useCallback(
      (index: number) => {
        'worklet';
        const toIndex = Math.max(0, Math.min(index, 2));
        snapToPosition(snapPoints[toIndex]);
        if (onIndexChange) {
          runOnJS(onIndexChange)(toIndex, SCREEN_HEIGHT + snapPoints[toIndex]);
        }
      },
      [snapToPosition, snapPoints, onIndexChange]
    );

    const toggle = useCallback(() => {
      if (active.value) {
        snapToIndex(0);
      } else {
        snapToIndex(1);
      }
    }, [active.value, snapToIndex]);

    const close = useCallback(() => {
      if (active.value) {
        snapToIndex(0);
      }
    }, [active.value, snapToIndex]);

    const open = useCallback(() => {
      if (!active.value) {
        snapToIndex(1);
      }
    }, [active.value, snapToIndex]);

    useImperativeHandle(ref, () => ({ snapToPosition, snapToIndex, toggle, open, close }), [
      snapToPosition,
      snapToIndex,
      toggle,
      open,
      close,
    ]);

    const context = useSharedValue({ y: 0 });
    const gesture = Gesture.Pan()
      .onStart(() => {
        context.value = { y: translateY.value };
      })
      .onUpdate((event) => {
        translateY.value = Math.max(event.translationY + context.value.y, snapPoints[2]);
      })
      .onEnd((event) => {
        if (event.velocityY < -1000) {
          snapToIndex(index.value + 1);
          return;
        }

        if (event.velocityY > 1000) {
          snapToIndex(index.value - 1);
          return;
        }

        const distanceBetweenPoints = distanceBetween(
          snapPoints[index.value],
          event.translationY > 0 ? snapPoints[Math.max(index.value - 1, 0)] : snapPoints[Math.min(index.value + 1, 2)]
        );

        if (Math.abs(event.translationY) > 0.15 * distanceBetweenPoints) {
          if (event.translationY > 0) {
            snapToIndex(index.value - 1);
          } else {
            snapToIndex(index.value + 1);
          }
        } else {
          snapToIndex(index.value);
        }
      });

    useDerivedValue(() => {
      if (positionValue) {
        const diff = Math.abs((translateY.value - snapPoints[0]) / (snapPoints[2] - snapPoints[0]));
        positionValue.value = diff;
      }
    });

    const rBottomSheetStyle = useAnimatedStyle(() => {
      const borderRadius = interpolate(translateY.value, [snapPoints[1], snapPoints[2]], [32, 0]);
      const paddingTop = interpolate(translateY.value, [snapPoints[1], snapPoints[2]], [0, insets.top]);
      return {
        borderRadius,
        paddingTop,
        transform: [{ translateY: translateY.value }],
      };
    });

    useEffectOnce(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (active.value) {
          snapToIndex(index.value - 1);
          return true;
        }
        return false;
      });

      return () => subscription.remove();
    });

    return (
      <>
        <GestureDetector gesture={gesture}>
          <Animated.View
            ref={animatedRef}
            style={[
              {
                height: frame.height,
                width: SCREEN_WIDTH,
                backgroundColor: theme.colors.surfaceContainerLow,
                position: 'absolute',
                top: frame.height,
                ...containerStyle,
              },
              shadow(5),
              rBottomSheetStyle,
            ]}
          >
            <View
              style={{
                width: 32,
                height: 4,
                backgroundColor: theme.colors.onSurfaceVariant + '66',
                alignSelf: 'center',
                marginVertical: 16,
                borderRadius: 2,
                ...indicatorStyle,
              }}
            />
            {children}
          </Animated.View>
        </GestureDetector>
      </>
    );
  }
);
