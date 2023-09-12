import { Flex } from '@ralens/react-native';

import { useIsFirstLaunch } from '@/core/onboard';

import { Welcome } from './welcome/Welcome';

export default function OnBoard() {
  const [, setIsFirstLaunch] = useIsFirstLaunch();

  return (
    <Flex flex={1}>
      <Welcome onContine={() => setIsFirstLaunch(false)} />
    </Flex>
  );
}
