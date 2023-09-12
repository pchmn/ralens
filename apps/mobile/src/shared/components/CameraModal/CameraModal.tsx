import { Flex, useSecureStorage } from '@ralens/react-native';
import { useIsFocused } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { TouchableRipple } from 'react-native-paper';
import { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera as VisionCamera, PhotoFile } from 'react-native-vision-camera';

import { CrossIcon } from '@/shared/components';
import { PermissionType, useMandatoryPermission } from '@/shared/hooks';

import { Modal } from '../Modal/Modal';
import { CaptureButton } from './CaptureButton';
import { PermissionDialog } from './PermissionDialog';
import { SwitchDeviceButton } from './SwitchDeviceButton';
import { SwitchFlashModeButton } from './SwitchFlashModeButton';
import { FlashMode, useCamera } from './useCamera';

const RATIO_16_9 = 16 / 9;
// const RATIO_4_3 = 4 / 3;

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

  const { ref, device, toggleDevice, takePhoto, isCapturing, photoFormat, orientation } = useCamera('16:9');

  const [, setMedia] = useState<PhotoFile>();

  const [flashMode, setFlashMode] = useSecureStorage<FlashMode>('flashMode', 'auto');

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
    setMedia(photo);
    console.log('photo', photo);
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
            enableZoomGesture
          />
          <Flex direction="row" justify="space-between" p="lg">
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
