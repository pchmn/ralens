import { Flex, useSecureStorage } from '@ralens/react-native';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { TouchableRipple } from 'react-native-paper';
import Animated, {
  Easing,
  FadeInRight,
  FadeOutRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera as VisionCamera, PhotoFile } from 'react-native-vision-camera';

import { PermissionType, useMandatoryPermission } from '@/shared/hooks';

import { CrossIcon } from '../icons';
import { Modal } from '../Modal/Modal';
import { CaptureButton } from './CaptureButton';
import { PermissionDialog } from './PermissionDialog';
import { SwitchDeviceButton } from './SwitchDeviceButton';
import { SwitchFlashModeButton } from './SwitchFlashModeButton';
import { FlashMode, useCamera } from './useCamera';

const RATIO_16_9 = 16 / 9;
// const RATIO_4_3 = 4 / 3;

export function CameraModal({
  visible,
  onClose,
  onCapture,
}: {
  visible: boolean;
  onClose: () => void;
  onCapture: (photo: PhotoFile) => void;
}) {
  return (
    <Modal
      visible={visible}
      onDismiss={onClose}
      fullScreen
      enteringAnimation={FadeInRight.duration(300)}
      exitingAnimation={FadeOutRight.duration(300)}
    >
      <Camera onClose={onClose} onCapture={onCapture} />
    </Modal>
  );
}

export function Camera({ onClose, onCapture }: { onClose: () => void; onCapture: (photo: PhotoFile) => void }) {
  const { t } = useTranslation();

  const { ref, device, toggleDevice, takePhoto, isCapturing, photoFormat, orientation } = useCamera('16:9');

  const [, setMedia] = useState<PhotoFile>();

  const [flashMode, setFlashMode] = useSecureStorage<FlashMode>('flashMode', 'auto');

  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const {
    status: cameraPermissionStatus,
    request: requestCameraPermission,
    dialogVisible: cameraPermissionDialogVisible,
  } = useMandatoryPermission(PermissionType.CAMERA);

  const isFocused = useIsFocused();

  const { height, width } = useSafeAreaFrame();
  const { top, bottom } = useSafeAreaInsets();
  const maxHeight = height - bottom;

  const cameraHeight = Math.min(width * RATIO_16_9, maxHeight);
  const isFullScreen = cameraHeight + top > maxHeight;

  const handleCapturePress = async () => {
    if (!cameraPermissionStatus?.granted) {
      return;
    }

    const photo = await takePhoto(flashMode);
    if (photo) {
      onCapture(photo);
    }
    setMedia(photo);
  };

  if (!device) {
    return null;
  }

  return (
    <>
      <PermissionDialog
        visible={cameraPermissionDialogVisible}
        title={t('camera.cameraPermissionDialog.title')}
        content={t('camera.cameraPermissionDialog.content')}
        grantButtonText={cameraPermissionStatus?.canAskAgain ? t('common.grantPermission') : t('common.settings')}
        onDismiss={onClose}
        onGrant={requestCameraPermission}
      />
      <Flex flex={1} bgColor="#000">
        <Flex
          width={width}
          height={cameraHeight}
          borderRadius={16}
          mt={isFullScreen ? 0 : top}
          pt={isFullScreen ? top : 0}
          justify="space-between"
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <FocusCircle x={focusPoint?.x} y={focusPoint?.y} />
          <VisionCamera
            ref={ref}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused}
            format={photoFormat}
            orientation={orientation}
            enableHighQualityPhotos
            photo
            enableZoomGesture
            onTouchStart={async (event) => {
              const focusPoint = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY - (isFullScreen ? 0 : top) };
              setFocusPoint(focusPoint);
              await ref.current?.focus(focusPoint);
            }}
          />
          <Flex direction="row" justify="space-between" px="xs" py="sm">
            {cameraPermissionStatus?.granted && <CloseButton onPress={onClose} />}
          </Flex>
          <Flex gap="xl" pb={30}>
            <Flex direction="row" align="center" justify="space-between">
              <Flex direction="row" flex={1} justify="center">
                <SwitchFlashModeButton
                  value={flashMode}
                  onChange={setFlashMode}
                  disabled={!cameraPermissionStatus?.granted || isCapturing}
                />
              </Flex>
              <CaptureButton
                onPress={handleCapturePress}
                disabled={!cameraPermissionStatus?.granted || isCapturing}
                mode="photo"
              />
              <Flex direction="row" flex={1} justify="center">
                <SwitchDeviceButton onPress={toggleDevice} disabled={!cameraPermissionStatus?.granted || isCapturing} />
              </Flex>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </>
  );
}

function CloseButton({ disabled, onPress }: { onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableRipple
      onPress={() => {
        onPress();
      }}
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

function FocusCircle({ x, y }: { x: number; y: number }) {
  const scale = useSharedValue(0);

  const animatedStyles = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    if (x !== 0 || x !== 0) {
      scale.value = withSequence(
        withTiming(1.2, { duration: 300, easing: Easing.cubic }),
        withTiming(1, { duration: 300, easing: Easing.cubic }),
        withDelay(1000, withTiming(0, { duration: 0, easing: Easing.cubic }))
      );
    }
  }, [scale, x, y]);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: y - 37.5,
          left: x - 37.5,
          height: 60,
          width: 60,
          borderRadius: 50,
          backgroundColor: '#0000001A',
          borderColor: '#fff',
          borderWidth: 2,
          zIndex: 2,
        },
        animatedStyles,
      ]}
    />
  );
}
