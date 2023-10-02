import { InMemoryCache } from '@apollo/client';
import { NhostClient, NhostProvider } from '@nhost/react';
import { getSecureStorageInstance, UiProvider } from '@ralens/react-native';
import { MMKVWrapper, persistCache } from 'apollo3-cache-persist';
import { Slot, SplashScreen, withLayoutContext } from 'expo-router';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  createMaterialBottomTabNavigator,
  MaterialBottomTabNavigationOptions,
} from 'react-native-paper/react-navigation';
import * as Sentry from 'sentry-expo';

import { AuthProvider } from '@/core/auth';
import { NhostApolloProvider } from '@/core/nhost';
import { OnBoardProvider } from '@/core/onboard';

const { Navigator } = createMaterialBottomTabNavigator();

export const MaterialBottomTabs = withLayoutContext<MaterialBottomTabNavigationOptions, typeof Navigator>(Navigator);

export const unstable_settings = {
  initialRouteName: 'films/index',
};

SplashScreen.preventAutoHideAsync();

const nhostParams = {
  authUrl: process.env.EXPO_PUBLIC_NHOST_AUTH_URL,
  graphqlUrl: process.env.EXPO_PUBLIC_NHOST_GRAPHQL_URL,
  storageUrl: process.env.EXPO_PUBLIC_NHOST_STORAGE_URL,
  functionsUrl: process.env.EXPO_PUBLIC_NHOST_FUNCTIONS_URL,
};

export default function RootLayout() {
  const [nhostClient, setNhostClient] = useState<NhostClient>();
  const [cache] = useState<InMemoryCache>(new InMemoryCache());

  useEffect(() => {
    async function init() {
      const storage = await getSecureStorageInstance();

      await persistCache({
        cache,
        storage: new MMKVWrapper(storage),
      });

      setNhostClient(
        new NhostClient({
          ...nhostParams,
          clientStorage: {
            setItem: storage.set.bind(storage),
            getItem: storage.getString.bind(storage),
            removeItem: storage.delete.bind(storage),
          },
          clientStorageType: 'react-native',
        })
      );
    }

    init().catch((err) => {
      console.error('error initializing secure storage', err);
      Sentry.Native.captureException(err);
    });
  }, [cache]);

  if (!nhostClient) {
    return null;
  }

  return (
    <NhostProvider nhost={nhostClient}>
      <NhostApolloProvider nhost={nhostClient} cache={cache}>
        <UiProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <OnBoardProvider>
                <Slot />
              </OnBoardProvider>
            </AuthProvider>
          </GestureHandlerRootView>
        </UiProvider>
      </NhostApolloProvider>
    </NhostProvider>
  );
}
