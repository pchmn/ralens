import { Event, EventsResponse, SUBSCRIBE_EVENTS } from '@ralens/core';
import {
  Flex,
  FlexTouchableRipple,
  SafeAreaView,
  spacingValue,
  Text,
  useAppTheme,
  useSubscription,
} from '@ralens/react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Dimensions } from 'react-native';
import { Button } from 'react-native-paper';

const { width } = Dimensions.get('window');
const itemSize = (width - spacingValue('sm') * 3) / 2;

function mapResults(data: EventsResponse) {
  const events = data.events.map((event) => ({
    ...event,
    fileCount: event.files_aggregate.aggregate.count,
  }));

  return events as (Event & { fileCount: number })[];
}

export default function Events() {
  const theme = useAppTheme();

  const { data: events } = useSubscription(SUBSCRIBE_EVENTS, {
    mapFn: mapResults,
  });

  const router = useRouter();

  const goToCreateEvent = useCallback(() => router.push('/events/create/'), [router]);

  return (
    <SafeAreaView withBottomTabs>
      <Flex flex={1} align="center" justify="center">
        <Flex width="100%" flex={1} p="sm">
          <FlashList
            numColumns={2}
            data={events}
            renderItem={({ item }) => (
              <FlexTouchableRipple
                flex={1}
                h={itemSize}
                m="sm"
                borderRadius={16}
                bgColor={theme.colors.tertiaryContainer}
                borderless
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                onPress={() => {}}
              >
                <Flex flex={1} justify="flex-end">
                  <Flex bgColor="#000" px={20} py={10} gap="xs">
                    <Text>{item.name}</Text>
                    <Text>{item.fileCount}</Text>
                  </Flex>
                </Flex>
              </FlexTouchableRipple>
            )}
            estimatedItemSize={itemSize}
          />
        </Flex>

        <Button onPress={goToCreateEvent}>Create Event</Button>
      </Flex>
      {/* <CameraModal
        visible={cameraVisible}
        onClose={() => {
          setCameraVisible(false);
        }}
        onCapture={(photo) => {
          console.log('onCapture', photo);
          setCameraVisible(false);
        }}
      />

      <CreateEventModal visible={createEventVisible} onClose={() => setCreateEventVisible(false)} /> */}
    </SafeAreaView>
  );
}
