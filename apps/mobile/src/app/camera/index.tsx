import { Flex } from '@ralens/react-native';
import { useRouter } from 'expo-router';

import { Camera } from './Camera/Camera';

export default function CameraModal() {
  // If the page was reloaded or navigated to directly, then the modal should be presented as
  // a full screen page. You may need to change the UI to account for this.
  // const isPresented = router.canGoBack();

  const router = useRouter();

  return (
    <Flex flex={1}>
      <Camera onClose={() => router.replace('../')} />
    </Flex>
  );
}
