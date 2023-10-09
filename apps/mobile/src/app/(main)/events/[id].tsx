import { Flex, SafeAreaView, Text } from '@ralens/react-native';
import { readAsStringAsync } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getType } from 'mime';
import { useState } from 'react';
import { Image } from 'react-native-compressor';
import { Appbar, Button } from 'react-native-paper';

import { ArrowLeftIcon, CameraModal } from '@/shared/components';
import { useNhostFunctions } from '@/shared/hooks';

export default function Event() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [cameraModalVisible, setCameraModalVisible] = useState(false);

  const { call } = useNhostFunctions();

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
          const name = result.substring(result.lastIndexOf('/') + 1, result.length);
          const base64 = await readAsStringAsync(result, { encoding: 'base64' });

          await call('UploadFile', {
            file: {
              name,
              content: `${base64}`,
              type: getType(name) || 'image/jpeg',
            },
            eventId: id,
          });
        }}
      />
    </>
  );
}
