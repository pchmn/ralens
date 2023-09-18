import { Event, SUBSCRIBE_EVENTS } from '@ralens/core';
import { Flex, FlexTouchableRipple, Text, useAppTheme, useSubscription } from '@ralens/react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraModal } from '@/shared/components';

import { BOTTOM_TABS_HEIGHT } from '../_layout';
import { CreateEventModal } from './CreateEventModal/CreateEventModal';

const { width } = Dimensions.get('window');
const itemSize = width / 2 - 16;

export default function Events() {
  const theme = useAppTheme();
  const [itemHeight, setItemHeight] = useState<number>();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [createEventVisible, setCreateEventVisible] = useState(false);

  const { data: events } = useSubscription<Event[]>(SUBSCRIBE_EVENTS);

  const router = useRouter();

  useEffect(() => {
    // console.log('events', events);
  }, [events]);

  return (
    <SafeAreaView style={{ flex: 1, paddingBottom: BOTTOM_TABS_HEIGHT }}>
      <Flex flex={1} align="center" justify="center">
        <Flex width="100%" flex={1} p="xs">
          <FlashList
            numColumns={2}
            data={events}
            renderItem={({ item }) => (
              <FlexTouchableRipple
                flex={1}
                h={itemSize}
                m="xs"
                borderRadius={16}
                bgColor={theme.colors.tertiaryContainer}
                borderless
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                onPress={() => {}}
                onLayout={({ nativeEvent: { layout } }) => {
                  if (!itemHeight) {
                    setItemHeight(layout.height);
                  }
                }}
              >
                <Flex flex={1} p={20} justify="center" align="center">
                  <Text>{item.name}</Text>
                </Flex>
              </FlexTouchableRipple>
            )}
            estimatedItemSize={itemSize}
          />
        </Flex>

        <Button
          onPress={() => {
            router.push('/events/create');
            // setCreateEventVisible(true);
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
    </SafeAreaView>
  );
}
