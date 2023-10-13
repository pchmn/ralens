import { useAccessToken } from '@nhost/react';
import { Flex, SafeAreaView, Text } from '@ralens/react-native';
import { FileSystemUploadType, uploadAsync } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image } from 'react-native-compressor';
import { Appbar, Button } from 'react-native-paper';

import { ArrowLeftIcon, CameraModal } from '@/shared/components';

export default function Event() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [cameraModalVisible, setCameraModalVisible] = useState(false);

  const accessToken = useAccessToken();

  return (
    <>
      <SafeAreaView>
        <Appbar.Header statusBarHeight={0}>
          <Appbar.Action
            animated={false}
            icon={({ color }) => <ArrowLeftIcon color={color} />}
            onPress={() => router.back()}
          />
        </Appbar.Header>
        <Flex flex={1} p="lg">
          <Text>Event {id}</Text>
          <Button onPress={() => setCameraModalVisible(true)}>Camera</Button>
        </Flex>
      </SafeAreaView>
      <CameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onCapture={async (file) => {
          const result = await Image.compress(`file://${file.path}`);

          await uploadAsync(`${process.env.EXPO_PUBLIC_NHOST_FUNCTIONS_URL}/UploadFile`, result, {
            httpMethod: 'POST',
            fieldName: 'file[]',
            uploadType: FileSystemUploadType.MULTIPART,
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'x-event-id': id,
            },
          });
        }}
      />
    </>
  );
}
