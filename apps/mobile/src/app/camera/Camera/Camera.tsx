import { Flex } from '@ralens/react-native';
import { useIsFocused } from '@react-navigation/native';
import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { Camera as VisionCamera, PhotoFile } from 'react-native-vision-camera';

import { PermissionType, usePermission } from '@/shared/hooks';

import { useCamera } from './useCamera';

const RATIO_16_9 = 16 / 9;

export function Camera({ onClose }: { onClose: () => void }) {
  const { device, toggleDevice, ref, takePhoto, photoFormat, orientation } = useCamera();

  const { status, request } = usePermission(PermissionType.CAMERA);

  const [media, setMedia] = useState<PhotoFile>();

  const isFocused = useIsFocused();

  const { width } = useSafeAreaFrame();

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
        height={width * RATIO_16_9}
        bgColor="#000"
        borderRadius={16}
        style={{ overflow: 'hidden', alignSelf: 'flex-end' }}
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
        <Button onPress={onClose}>Close</Button>
        <Button
          onPress={async () => {
            const photo = await takePhoto();
            setMedia(photo);
          }}
        >
          Take photo - {media?.width}x{media?.height}
        </Button>
        <Image source={{ uri: `file://${media?.path}` }} style={{ width: 100, height: 100 }} />
      </Flex>
      <Button onPress={toggleDevice}>Toggle device</Button>
    </Flex>
  );
}
