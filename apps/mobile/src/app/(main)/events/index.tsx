import { Flex } from '@ralens/react-native';
import { useState } from 'react';
import { Button } from 'react-native-paper';

import { CameraModal } from './components/CameraModal';

export default function Events() {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Flex flex={1} align="center" justify="center">
        <Button onPress={() => setOpened(true)}>Open Camera</Button>
      </Flex>
      <CameraModal opened={opened} onClose={() => setOpened(false)} />
    </>
  );
}
