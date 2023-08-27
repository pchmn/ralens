import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { createContext, useEffect } from 'react';

import { useIsFirstLaunch } from './useIsFirstLaunch';

const OnBoardContext = createContext(null);

function useOnBoard() {
  const [isFirstLaunch] = useIsFirstLaunch();

  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState.key) {
      return;
    }

    const isOnBoardGroup = segments[0] === 'onboard';

    if (isFirstLaunch && !isOnBoardGroup) {
      router.replace('/onboard');
    } else if (!isFirstLaunch && isOnBoardGroup) {
      router.replace('/');
    }
  }, [isFirstLaunch, navigationState.key, router, segments]);

  return null;
}

export function OnBoardProvider({ children }: { children: React.ReactNode }) {
  useOnBoard();

  return <OnBoardContext.Provider value={null}>{children}</OnBoardContext.Provider>;
}
