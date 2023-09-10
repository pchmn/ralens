import { Flex } from '@ralens/react-native';
import { useIsFocused } from '@react-navigation/native';
import { openSettings } from 'expo-linking';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { TouchableRipple } from 'react-native-paper';
import { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera as VisionCamera, PhotoFile, VideoFile } from 'react-native-vision-camera';

import { CrossIcon } from '@/shared/components';
import { PermissionType, useMandatoryPermission } from '@/shared/hooks';

import { Modal } from '../Modal/Modal';
import { CaptureButton } from './CaptureButton';
import { CaptureMode, CaptureModeCarousel } from './CaptureModeCarousel';
import { PermissionDialog } from './PermissionDialog';
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
  const { t } = useTranslation();

  const {
    ref,
    device,
    toggleDevice,
    takePhoto,
    startRecording,
    stopRecording,
    isRecording,
    isCapturing,
    photoFormat,
    videoFormat,
    orientation,
  } = useCamera('16:9');

  const [, setMedia] = useState<PhotoFile | VideoFile>();

  const [flashMode, setFlashMode] = useState<FlashMode>('auto');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');

  const {
    status: cameraPermissionStatus,
    request: requestCameraPermission,
    dialogVisible: cameraPermissionDialogVisible,
  } = useMandatoryPermission(PermissionType.CAMERA);
  const {
    status: microPermissionStatus,
    request: requestMicroPermission,
    dialogVisible: microPermissionDialogVisible,
  } = useMandatoryPermission(PermissionType.MICROPHONE, { when: captureMode === 'video' });

  const isFocused = useIsFocused();

  const { height, width } = useSafeAreaFrame();
  const { top, bottom } = useSafeAreaInsets();
  const maxHeight = height - bottom;

  const cameraHeight = Math.min(width * RATIO_16_9, maxHeight);
  const isFullScreen = cameraHeight + top > maxHeight;
  const hasToContainCaptureMode = isFullScreen || cameraHeight + top + CAPTURE_MODE_HEIGHT > maxHeight;

  const handleCapturePress = async () => {
    if (!cameraPermissionStatus?.granted) {
      return;
    }
    if (captureMode === 'video' && !microPermissionStatus?.granted) {
      return;
    }

    if (captureMode === 'photo') {
      // Photo
      const media = await takePhoto(flashMode);
      setMedia(media);
    } else if (isRecording) {
      // Stop video recording
      stopRecording();
    } else {
      // Start video recording
      const video = await startRecording(flashMode);
      setMedia(video);
    }
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
      <PermissionDialog
        visible={!!microPermissionDialogVisible}
        title={t('camera.microphonePermissionDialog.title')}
        content={t('camera.microphonePermissionDialog.content')}
        grantButtonText={microPermissionStatus?.canAskAgain ? t('common.grantPermission') : t('common.settings')}
        onDismiss={onClose}
        onGrant={microPermissionStatus?.canAskAgain ? requestMicroPermission : openSettings}
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
            {cameraPermissionStatus?.granted && <CloseButton onPress={onClose} />}
          </Flex>
          <Flex gap="xl" pb={hasToContainCaptureMode ? undefined : 30}>
            <Flex direction="row" align="center" justify="space-between">
              <Flex direction="row" flex={1} justify="center">
                <SwitchFlashModeButton
                  value={flashMode}
                  onChange={setFlashMode}
                  disabled={cameraPermissionStatus?.granted !== true}
                />
              </Flex>
              <CaptureButton
                onPress={handleCapturePress}
                disabled={!cameraPermissionStatus?.granted || isCapturing}
                mode={captureMode}
                isRecording={isRecording}
              />
              <Flex direction="row" flex={1} justify="center">
                <SwitchDeviceButton onPress={toggleDevice} disabled={cameraPermissionStatus?.granted !== true} />
              </Flex>
            </Flex>
            {hasToContainCaptureMode && (
              <Flex direction="row" justify="center" pb="xl">
                {cameraPermissionStatus?.granted && (
                  <CaptureModeCarousel value={captureMode} onChange={setCaptureMode} isCapturing={isCapturing} />
                )}
              </Flex>
            )}
          </Flex>
        </Flex>
        {!hasToContainCaptureMode && (
          <Flex direction="row" justify="center" pt="sm">
            {cameraPermissionStatus?.granted && (
              <CaptureModeCarousel value={captureMode} onChange={setCaptureMode} isCapturing={isCapturing} />
            )}
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
