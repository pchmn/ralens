import { Flex, useAppTheme } from '@ralens/react-native';
import { setBackgroundColorAsync as setNavigationBarBackgroundColorAsync } from 'expo-navigation-bar';
import { useEffect } from 'react';

import { Welcome } from './welcome/Welcome';

export default function OnBoard() {
  const theme = useAppTheme();

  useEffect(() => {
    setTimeout(() => setNavigationBarBackgroundColorAsync(theme.colors.background));
  }, [theme]);

  return (
    <Flex flex={1}>
      <Welcome onContine={() => console.log('continue')} />
    </Flex>
  );
}
