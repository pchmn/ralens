import { Flex, useAppTheme } from '@ralens/react-native';
import { useIsFocused } from '@react-navigation/native';
// import { Camera, FlashMode } from 'expo-camera';
import { useRef, useState } from 'react';
import { Modal, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { Button, TouchableRipple } from 'react-native-paper';
import Animated, {
  Extrapolate,
  FadeInDown,
  FadeOutUp,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, CameraDevice, useCameraDevices } from 'react-native-vision-camera';

import { FlashAutoIcon, FlashOffIcon, FlashOnIcon, SwitchIcon } from '@/shared/components';

function useCamera() {
  const devices = useCameraDevices();
  const [device, setDevice] = useState<CameraDevice | undefined>();

  const ref = useRef<Camera>(null);

  if (!device && devices.back) {
    setDevice(devices.back);
  }

  const toggleDevice = () => {
    setDevice((prev) => (prev === devices.back ? devices.front : devices.back));
  };

  const takePhoto = async () => {
    const photo = await ref.current?.takePhoto({ qualityPrioritization: 'quality', flash: 'auto' });
    console.log('photo', photo);
    return photo;
  };

  return { device, toggleDevice, ref, takePhoto };
}

export function CameraModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal visible={opened} onRequestClose={onClose} statusBarTranslucent>
      <CameraView />
    </Modal>
  );
}

export function CameraView() {
  const { device, toggleDevice, ref } = useCamera();
  // const [imagePath, setImagePath] = useState<string | undefined>();

  const insets = useSafeAreaInsets();
  // const { width } = useSafeAreaFrame();

  const isFocused = useIsFocused();

  const requestPermission = async () => {
    const newCameraPermission = await Camera.requestCameraPermission();
    console.log('newCameraPermission', newCameraPermission);
  };

  if (!device) {
    return (
      <Flex flex={1} align="center" justify="center">
        <Button onPress={requestPermission}>Request permission</Button>
      </Flex>
    );
  }

  return (
    <Flex flex={1} justify="space-between">
      <Camera ref={ref} style={StyleSheet.absoluteFill} device={device} isActive={isFocused} photo enableZoomGesture />
      <Flex
        // backgroundColor="#00000066"
        direction="row"
        align="center"
        justify="space-between"
        paddingX="lg"
        paddingY={32}
        style={{ paddingTop: insets.top + 20 }}
      >
        <SwitchFlashMode onPress={toggleDevice} />
        <SwitchFlashMode onPress={toggleDevice} />
      </Flex>
      <Flex direction="row" align="center" justify="space-between" style={{ paddingBottom: 50 }}>
        {/* <SwitchDeviceButton onPress={toggleDevice} /> */}
        {/* <IconButton icon="cached" size={32} iconColor="#fff" onPress={toggleDevice} /> */}
        {/* <View style={{ borderRadius: 35, borderColor: '#ffffff99', padding: 5, borderWidth: 2 }}>
          <TouchableRipple
            onPress={async () => {
              // const image = await takePhoto();
              // setImagePath(image?.path);
            }}
            style={{ backgroundColor: '#fff', padding: 25, borderRadius: 25 }}
          >
            <View />
          </TouchableRipple>
        </View> */}
        <Flex direction="row" flex={1} justify="center">
          <SwitchFlashMode onPress={toggleDevice} />
        </Flex>
        <TakePhotoButton
          onPress={() => {
            console.log('take photo');
          }}
        />
        <Flex direction="row" flex={1} justify="center">
          <SwitchDeviceButton onPress={toggleDevice} />
        </Flex>

        {/* <IconButton icon="flash" size={24} iconColor="#fff" onPress={toggleDevice} /> */}
        {/* <SwitchFlashMode onPress={toggleDevice} /> */}

        {/* <Image source={{ uri: `file://${imagePath}` }} style={{ width: 100, height: 100 }} /> */}
      </Flex>
    </Flex>
  );
}

function TakePhotoButton({ onPress }: { onPress: () => void }) {
  const theme = useAppTheme();

  const [pressed, setPressed] = useState(false);

  return (
    <TouchableScale
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{ borderRadius: 40, borderColor: '#ffffff99', padding: 5, borderWidth: 3, backgroundColor: '#0000004D' }}
    >
      <TouchableRipple
        style={{ backgroundColor: pressed ? theme.colors.tertiary : '#fff', padding: 30, borderRadius: 30 }}
      >
        <View />
      </TouchableRipple>
    </TouchableScale>
  );
}

function SwitchDeviceButton({ onPress }: { onPress: () => void }) {
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
      style={{ borderRadius: 40, borderColor: '#ffffff99', padding: 7, borderWidth: 3, backgroundColor: '#0000004D' }}
    >
      <Animated.View style={animatedStyle}>
        <SwitchIcon color="#fff" size={28} />
      </Animated.View>
    </TouchableRipple>
  );
}

function SwitchFlashMode({ onPress }: { onPress: () => void }) {
  const [flashMode, setFlashMode] = useState<'on' | 'off' | 'auto'>('auto');

  return (
    <TouchableRipple
      onPress={() => {
        onPress();
        switch (flashMode) {
          case 'on':
            setFlashMode('auto');
            break;
          case 'off':
            setFlashMode('on');
            break;
          case 'auto':
            setFlashMode('off');
            break;
        }
      }}
      rippleColor="rgba(0, 0, 0, .32)"
      borderless
      style={{ borderRadius: 40, borderColor: '#ffffff99', padding: 7, borderWidth: 3, backgroundColor: '#0000004D' }}
    >
      <Animated.View key={flashMode} entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(200)}>
        {flashMode === 'on' ? (
          <FlashOnIcon color="#fff" size={28} />
        ) : flashMode === 'off' ? (
          <FlashOffIcon color="#fff" size={28} />
        ) : (
          <FlashAutoIcon color="#fff" size={28} />
        )}
      </Animated.View>
    </TouchableRipple>
  );
}

function TouchableScale({
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
