import { Flex } from '@ralens/react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from 'react-native-paper';

import { CameraModal } from '@/shared/components';

export default function Events() {
  const [opened, setOpened] = useState(false);
  const router = useRouter();

  return (
    <>
      <Flex flex={1} align="center" justify="center">
        <Button
          onPress={() => {
            // setOpened(true);
            // console.log('opened', opened);
            router.push('camera');
          }}
        >
          Open Camera
        </Button>
      </Flex>
      {opened && (
        <CameraModal
          opened={opened}
          onClose={() => {
            setOpened(false);
            console.log('closed', opened);
          }}
        />
      )}
    </>
  );
}
