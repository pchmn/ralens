import { Flex, SafeAreaView, Text } from '@ralens/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Appbar } from 'react-native-paper';

import { ArrowLeftIcon } from '@/shared/components';

export default function Event() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  return (
    <SafeAreaView>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.Action icon={({ color }) => <ArrowLeftIcon color={color} />} onPress={() => router.back()} />
      </Appbar.Header>
      <Flex flex={1} p="lg">
        <Text>Event {id}</Text>
      </Flex>
    </SafeAreaView>
  );
}
