import { Flex, Text, TouchableScale, useAppTheme } from '@ralens/react-native';
import { useIsFocused } from '@react-navigation/native';
import { useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { TouchableRipple } from 'react-native-paper';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera as VisionCamera, PhotoFile } from 'react-native-vision-camera';

import { CrossIcon, FlashAutoIcon, FlashOffIcon, FlashOnIcon, SwitchIcon } from '@/shared/components';
import { PermissionType, usePermission } from '@/shared/hooks';

import { FlashMode, useCamera } from './useCamera';

const RATIO_16_9 = 16 / 9;
const { width, height } = Dimensions.get('window');

export function Camera({ onClose }: { onClose: () => void }) {
  const { device, toggleDevice, ref, takePhoto, photoFormat, orientation } = useCamera();

  const { status, request } = usePermission(PermissionType.CAMERA);

  const [, setMedia] = useState<PhotoFile>();

  const [flashMode, setFlashMode] = useState<FlashMode>('auto');

  const isFocused = useIsFocused();

  // const { width } = useSafeAreaFrame();
  const { top } = useSafeAreaInsets();
  const cameraHeight = Math.min(width * RATIO_16_9, height);
  const isFullScreen = cameraHeight === height;
  console.log('isFullScreen', Platform.OS, { isFullScreen, cameraHeight, height });

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
        <Flex gap="xl">
          <Flex direction="row" align="center" justify="space-between">
            <Flex direction="row" flex={1} justify="center">
              <SwitchFlashMode value={flashMode} onChange={setFlashMode} disabled={status?.granted !== true} />
            </Flex>
            <TakePhotoButton
              onPress={async () => setMedia(await takePhoto(flashMode))}
              disabled={status?.granted !== true}
            />
            <Flex direction="row" flex={1} justify="center">
              <SwitchDeviceButton onPress={toggleDevice} disabled={status?.granted !== true} />
            </Flex>
          </Flex>
          <Flex direction="row" justify="center" pb="xl">
            {/* <Button mode="contained-tonal" compact>Photo</Button> */}
            <Text color="#fff" uppercase fontWeight="600" style={{ borderBottomColor: '#fff', borderBottomWidth: 1 }}>
              Photo
            </Text>
          </Flex>
        </Flex>
        {/* <Button onPress={onClose}>Close</Button> */}
        {/* <Button
          onPress={async () => {
            const photo = await takePhoto();
            setMedia(photo);
          }}
        >
          Take photo - {media?.width}x{media?.height}
        </Button> */}
        {/* <Image source={{ uri: `file://${media?.path}` }} style={{ width: 100, height: 177.8 }} /> */}
      </Flex>
      {/* <Button onPress={toggleDevice}>Toggle device</Button> */}
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
        borderRadius: 40,
        borderColor: '#ffffff80',
        borderWidth: 6,
        opacity: disabled ? 0.5 : 1,
      }}
      disabled={disabled}
    >
      <View style={{ backgroundColor: pressed ? theme.colors.tertiary : '#fff', padding: 30, borderRadius: 30 }}>
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
        borderColor: '#ffffff33',
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

function SwitchFlashMode({
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
        borderColor: '#ffffff33',
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
        // borderColor: '#ffffff33',
        // borderWidth: 1,
        padding: 8,
        // backgroundColor: '#00000033',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <CrossIcon color="#fff" size={32} />
    </TouchableRipple>
  );
}
