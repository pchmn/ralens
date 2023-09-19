import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Flex } from './Flex';

interface SafeAreaViewProps {
  children: React.ReactNode;
  withBottomTabs?: boolean;
}

export const BOTTOM_TABS_HEIGHT = 80;

export function SafeAreaView({ children, withBottomTabs }: SafeAreaViewProps) {
  const { top, bottom } = useSafeAreaInsets();

  return (
    <Flex flex={1} pt={top} pb={bottom + (withBottomTabs ? BOTTOM_TABS_HEIGHT : 0)}>
      {children}
    </Flex>
  );
}
