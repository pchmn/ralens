import { Flex, Text } from '@ralens/react-native';
import { useIsFocused } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet } from 'react-native';
import { Button, Dialog, Portal, TouchableRipple } from 'react-native-paper';
import { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera as VisionCamera, PhotoFile } from 'react-native-vision-camera';

import { CrossIcon } from '@/shared/components';
import { PermissionType, usePermission } from '@/shared/hooks';

import { Modal } from '../Modal/Modal';
import { CaptureButton } from './CaptureButton';
import { CaptureMode, CaptureModeCarousel } from './CaptureModeCarousel';
import { SwitchDeviceButton } from './SwitchDeviceButton';
import { SwitchFlashModeButton } from './SwitchFlashModeButton';
import { FlashMode, useCamera } from './useCamera';

const RATIO_16_9 = 16 / 9;
// const RATIO_4_3 = 4 / 3;
const CAPTURE_MODE_HEIGHT = 48;

export function CameraModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal
      visible={visible}
      onDismiss={onClose}
      fullScreen
      enteringAnimation={FadeInDown.duration(200)}
      exitingAnimation={FadeOut.duration(200)}
    >
      <Camera onClose={onClose} />
    </Modal>
  );
}

export function Camera({ onClose }: { onClose: () => void }) {
  const {
    device,
    toggleDevice,
    ref,
    takePhoto,
    startRecording,
    stopRecording,
    isRecording,
    photoFormat,
    videoFormat,
    orientation,
  } = useCamera('16:9');

  const { status, request, openSettings } = usePermission(PermissionType.CAMERA);
  const [isFirstAsk, setIsFirstAsk] = useState(true);
  const [cameraPermissionModalVisible, setCameraPermissionModalVisible] = useState(false);
  if (status && !status.granted && (!status.canAskAgain || !isFirstAsk) && cameraPermissionModalVisible !== true) {
    setCameraPermissionModalVisible(true);
  } else if (status?.granted && cameraPermissionModalVisible !== false) {
    setCameraPermissionModalVisible(false);
  }

  if (!status?.granted && status?.canAskAgain && isFirstAsk) {
    setIsFirstAsk(false);
    request();
  }

  const [, setMedia] = useState<PhotoFile>();

  const [flashMode, setFlashMode] = useState<FlashMode>('auto');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');

  const isFocused = useIsFocused();

  const { height, width } = useSafeAreaFrame();
  const { top, bottom } = useSafeAreaInsets();
  const maxHeight = height - bottom;

  const cameraHeight = Math.min(width * RATIO_16_9, maxHeight);
  const isFullScreen = cameraHeight + top > maxHeight;
  const hasToContainCaptureMode = isFullScreen || cameraHeight + top + CAPTURE_MODE_HEIGHT > maxHeight;

  if (!device) {
    return null;
  }

  return (
    <>
      <CameralPermissionDialog
        visible={cameraPermissionModalVisible}
        onDismiss={onClose}
        onOpenSettings={() => {
          openSettings();
        }}
      />
      <Flex flex={1} bgColor="#000">
        <Flex
          width={width}
          height={cameraHeight}
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
            format={captureMode === 'photo' ? photoFormat : videoFormat}
            orientation={orientation}
            enableHighQualityPhotos
            photo
            video
            enableZoomGesture
          />
          <Flex direction="row" justify="space-between" p="lg">
            {status?.granted && <CloseButton onPress={onClose} />}
          </Flex>
          <Flex gap="xl" pb={hasToContainCaptureMode ? undefined : 30}>
            <Flex direction="row" align="center" justify="space-between">
              <Flex direction="row" flex={1} justify="center">
                <SwitchFlashModeButton value={flashMode} onChange={setFlashMode} disabled={status?.granted !== true} />
              </Flex>
              <CaptureButton
                onPress={async () => {
                  if (isRecording) {
                    stopRecording();
                    return;
                  }
                  if (captureMode === 'photo') {
                    const media = await takePhoto(flashMode);
                    setMedia(media);
                    Image.getSize(`file://${media?.path}`, (width, height) => {
                      console.log('image size', { width, height });
                    });
                    return;
                  }
                  const video = await startRecording(flashMode);
                  console.log('video', video);
                }}
                disabled={status?.granted !== true}
                mode={captureMode}
                isRecording={isRecording}
                onLongPress={async () => {
                  const video = await startRecording(flashMode);
                  console.log('video', video);
                }}
              />
              <Flex direction="row" flex={1} justify="center">
                <SwitchDeviceButton onPress={toggleDevice} disabled={status?.granted !== true} />
              </Flex>
            </Flex>
            {hasToContainCaptureMode && (
              <Flex direction="row" justify="center" pb="xl">
                {status?.granted && <CaptureModeCarousel onChange={setCaptureMode} />}
              </Flex>
            )}
          </Flex>
        </Flex>
        {!hasToContainCaptureMode && (
          <Flex direction="row" justify="center" pt="sm">
            {status?.granted && <CaptureModeCarousel onChange={setCaptureMode} />}
          </Flex>
        )}
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

function CameralPermissionDialog({
  visible,
  onDismiss,
  onOpenSettings,
}: {
  visible: boolean;
  onDismiss: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} dismissable={false}>
        <Dialog.Title>{t('camera.cameraPermissionDialog.title')}</Dialog.Title>
        <Dialog.Content>
          <Text>{t('camera.cameraPermissionDialog.content')}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('camera.cameraPermissionDialog.dismiss')}</Button>
          <Button onPress={onOpenSettings}>{t('common.settings')}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
