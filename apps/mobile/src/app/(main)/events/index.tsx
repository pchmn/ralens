import { ResultOf } from '@graphql-typed-document-node/core';
import { scalars, typedGql } from '@ralens/core';
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
import { Appbar, Button } from 'react-native-paper';

const { width } = Dimensions.get('window');
const itemSize = (width - spacingValue('sm') * 3) / 2;

const subscribeEvents = typedGql('subscription', { scalars })({
  events: [
    {},
    {
      id: true,
      name: true,
      files_aggregate: [{}, { aggregate: { count: [{ distinct: true }, true] } }],
      participants_aggregate: [{}, { aggregate: { count: [{ distinct: true }, true] } }],
    },
  ],
});

function mapResults(data: ResultOf<typeof subscribeEvents>) {
  return data.events.map((event) => ({
    id: event.id,
    name: event.name,
    fileCount: event.files_aggregate.aggregate?.count,
    participantCount: event.participants_aggregate?.aggregate?.count,
  }));
}

export default function Events() {
  const theme = useAppTheme();

  const router = useRouter();

  const { data: events } = useSubscription(subscribeEvents, {
    mapFn: mapResults,
  });

  const goToCreateEvent = useCallback(() => router.push('/events/create/'), [router]);

  return (
    <SafeAreaView withBottomTabs>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.Content title="Events" />
      </Appbar.Header>
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
                onPress={() => router.push(`/events/${item.id}`)}
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
