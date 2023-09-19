import { Event, SUBSCRIBE_EVENTS } from '@ralens/core';
import { Flex, FlexTouchableRipple, SafeAreaView, Text, useAppTheme, useSubscription } from '@ralens/react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Dimensions } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const itemSize = width / 2 - 16;

export function DefEvents() {
  console.log('in Settings');
  const { top, bottom } = useSafeAreaInsets();

  return (
    <Flex style={{ flex: 1, paddingTop: top, paddingBottom: bottom }}>
      <Flex flex={1} align="center" justify="center">
        <Text>DefEvents</Text>
      </Flex>
    </Flex>
  );
}

export default function Events() {
  const theme = useAppTheme();

  const { data: events } = useSubscription<Event[]>(SUBSCRIBE_EVENTS);

  const router = useRouter();

  const goToCreateEvent = useCallback(() => router.push('/events/create/'), [router]);

  return (
    <SafeAreaView withBottomTabs>
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
              >
                <Flex flex={1} p={20} justify="center" align="center">
                  <Text>{item.name}</Text>
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
