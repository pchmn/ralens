import { Flex } from '@ralens/react-native';
import { useState } from 'react';
import { Button } from 'react-native-paper';

import { CameraModal } from '@/shared/components';

import { CreateEventModal } from './CreateEventModal/CreateEventModal';

export default function Events() {
  const [cameraVisible, setCameraVisible] = useState(false);
  const [createEventVisible, setCreateEventVisible] = useState(false);

  console.log('Events');

  return (
    <>
      <Flex flex={1} align="center" justify="center">
        <Button
          onPress={() => {
            setCameraVisible(true);
          }}
        >
          Open Camera
        </Button>

        <Button
          onPress={() => {
            setCreateEventVisible(true);
          }}
        >
          Create Event
        </Button>
      </Flex>
      <CameraModal
        visible={cameraVisible}
        onClose={() => {
          setCameraVisible(false);
        }}
        onCapture={(photo) => {
          console.log('onCapture', photo);
          setCameraVisible(false);
        }}
      />

      <CreateEventModal visible={createEventVisible} onClose={() => setCreateEventVisible(false)} />
    </>
  );
}
