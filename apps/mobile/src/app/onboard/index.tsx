import { Flex, useAppTheme } from '@prevezic/react-native';
import { Button } from 'react-native-paper';

import { useIsFirstLaunch } from '@/core/onboard';

export default function OnBoard() {
  const [, setIsFirstLaunch] = useIsFirstLaunch();

  const theme = useAppTheme();

  const completeOnBoard = () => {
    console.log('completeOnBoard');
    setIsFirstLaunch(false);
  };

  return (
    <Flex flex={1} align="center" justify="center" backgroundColor={theme.colors.background}>
      <Button onPress={completeOnBoard}>Next</Button>
    </Flex>
  );
}
