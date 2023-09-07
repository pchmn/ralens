import { Flex, TouchableScale, useAppTheme } from '@ralens/react-native';
import { useIsFocused } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { TouchableRipple } from 'react-native-paper';
import Animated, {
  Extrapolate,
  FadeInDown,
  FadeOutUp,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera as VisionCamera, PhotoFile } from 'react-native-vision-camera';

import { CrossIcon, FlashAutoIcon, FlashOffIcon, FlashOnIcon, SwitchIcon } from '@/shared/components';
import { PermissionType, usePermission } from '@/shared/hooks';

import { FlashMode, useCamera } from './useCamera';

const RATIO_16_9 = 16 / 9;

export function Camera({ onClose }: { onClose: () => void }) {
  const { device, toggleDevice, ref, takePhoto, photoFormat, orientation } = useCamera();

  const { status, request } = usePermission(PermissionType.CAMERA);

  const [, setMedia] = useState<PhotoFile>();

  const [flashMode, setFlashMode] = useState<FlashMode>('auto');

  const [, setCaptureMode] = useState<CaptureMode>('photo');

  const isFocused = useIsFocused();

  const { height, width } = useSafeAreaFrame();
  const { top, bottom } = useSafeAreaInsets();

  const cameraHeight = Math.min(width * RATIO_16_9, height - bottom);
  const isFullScreen = cameraHeight + top > height - bottom;
  // const canExcludeCaptureMode = cameraHeight + top + 48 <= height - bottom;
  const hasToContainCaotureMode = isFullScreen || cameraHeight + top + 48 > height - bottom;

  if (!status?.granted && status?.canAskAgain) {
    request();
  }

  if (!device) {
    return null;
  }

  return (
    <Flex flex={1}>
      <Flex
        width={width}
        height={cameraHeight}
        bgColor="#000"
        borderRadius={16}
        mt={isFullScreen ? 0 : top}
        pt={isFullScreen ? top : 0}
        justify="space-between"
        style={{ overflow: 'hidden' }}
      >
        <VisionCamera
          ref={ref}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isFocused}
          format={photoFormat}
          orientation={orientation}
          enableHighQualityPhotos
          photo
          video
          enableZoomGesture
        />
        <Flex direction="row" justify="space-between" p="lg">
          <CloseButton onPress={onClose} />
        </Flex>
        <Flex gap="xl" pb={hasToContainCaotureMode ? undefined : 30}>
          <Flex direction="row" align="center" justify="space-between">
            <Flex direction="row" flex={1} justify="center">
              <SwitchFlashModeButton value={flashMode} onChange={setFlashMode} disabled={status?.granted !== true} />
            </Flex>
            <TakePhotoButton
              onPress={async () => setMedia(await takePhoto(flashMode))}
              disabled={status?.granted !== true}
            />
            <Flex direction="row" flex={1} justify="center">
              <SwitchDeviceButton onPress={toggleDevice} disabled={status?.granted !== true} />
            </Flex>
          </Flex>
          {hasToContainCaotureMode && (
            <Flex direction="row" justify="center" pb="xl">
              <CaptureModeCarousel onChange={setCaptureMode} />
            </Flex>
          )}
        </Flex>
      </Flex>
      <Flex direction="row" justify="center" pt="sm">
        <CaptureModeCarousel onChange={setCaptureMode} />
      </Flex>
    </Flex>
  );
}

function TakePhotoButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const theme = useAppTheme();

  const [pressed, setPressed] = useState(false);

  return (
    <TouchableScale
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        borderRadius: 41,
        borderColor: '#ffffff80',
        borderWidth: 6,
        opacity: disabled ? 0.5 : 1,
      }}
      disabled={disabled}
    >
      <View style={{ backgroundColor: pressed ? theme.colors.tertiary : '#fff', padding: 35, borderRadius: 35 }}>
        <View />
      </View>
    </TouchableScale>
  );
}

function SwitchDeviceButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
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
      rippleColor="rgba(0, 0, 0, .32)"
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
      <Animated.View style={animatedStyle}>
        <SwitchIcon color="#fff" size={28} />
      </Animated.View>
    </TouchableRipple>
  );
}

function SwitchFlashModeButton({
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
      rippleColor="rgba(0, 0, 0, .32)"
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

function CloseButton({ disabled, onPress }: { onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableRipple
      onPress={() => {
        onPress();
      }}
      rippleColor="rgba(0, 0, 0, .32)"
      borderless
      disabled={disabled}
      style={{
        borderRadius: 40,
        padding: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <CrossIcon color="#fff" size={32} />
    </TouchableRipple>
  );
}

type CaptureMode = 'photo' | 'video';

function CaptureModeCarousel({ onChange }: { onChange: (value: CaptureMode) => void }) {
  const { t } = useTranslation();

  const carouselRef = useRef<ICarouselInstance>(null);

  const data = useMemo(() => [t('camera.photo'), t('camera.video')] as CaptureMode[], [t]);

  return (
    <Carousel
      ref={carouselRef}
      width={120}
      height={40}
      mode="parallax"
      loop={false}
      modeConfig={{
        parallaxScrollingScale: 0.9,
        parallaxScrollingOffset: 50,
      }}
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible',
      }}
      scrollAnimationDuration={300}
      data={data}
      defaultIndex={0}
      onSnapToItem={(index) => onChange(data[index])}
      customAnimation={(value: number) => {
        'worklet';
        const scale = interpolate(value, [-1, 0, 1], [0.9, 1, 0.9], Extrapolate.CLAMP);
        const translate = interpolate(value, [0, 1], [0, 80]);
        const backgroundColor = interpolateColor(value, [-1, 0, 1], ['transparent', '#00000008', 'transparent']);

        return {
          transform: [
            { scale },
            {
              translateX: translate,
            },
            { perspective: 150 },
          ],
          backgroundColor,
          width: 80,
          borderRadius: 40,
        };
      }}
      renderItem={({ index, item, animationValue }) => (
        <CaptureModeItem
          animationValue={animationValue}
          text={item}
          onPress={() => carouselRef.current?.scrollTo({ index, animated: true })}
        />
      )}
    />
  );
}

function CaptureModeItem({
  animationValue,
  text,
  onPress,
}: {
  animationValue: Animated.SharedValue<number>;
  text: string;
  onPress?: () => void;
}) {
  const textAnimatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(animationValue.value, [-1, 0, 1], ['#ffffff80', '#fff', '#ffffff80']);

    return {
      color,
      textTransform: 'uppercase',

      fontWeight: '600',
    };
  });

  return (
    <TouchableRipple
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 40,
      }}
      onPress={onPress}
      borderless
    >
      <Animated.Text style={textAnimatedStyle}>{text}</Animated.Text>
    </TouchableRipple>
  );
}
