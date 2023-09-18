import { Flex, Text, useEffectOnce } from '@ralens/react-native';
import { useRouter } from 'expo-router';
import { BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateEvent() {
  const router = useRouter();

  useEffectOnce(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.push('/events');
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  });

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Flex flex={1} justify="center" align="center" mb={0}>
        <Flex height={10} width={10} position="absolute" style={{ top: 0, left: 0 }} bgColor="red" />
        <Flex height={10} width={10} position="absolute" style={{ bottom: 0, left: 0, zIndex: 5 }} bgColor="red" />
        <Text>Create Event</Text>
      </Flex>
    </SafeAreaView>
  );
}
