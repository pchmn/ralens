import { NhostClient, NhostProvider } from '@nhost/react';
import { NhostApolloProvider } from '@nhost/react-apollo';
import { getSecureStorageInstance, isSecureStorageInitialized, UiProvider } from '@prevezic/react-native';
import { Slot, SplashScreen, withLayoutContext } from 'expo-router';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import createMaterialBottomTabNavigator from '@/shared/utils/materialBottomNav/createMaterialBottomTabNavigator';
// import { MaterialBottomTabNavigationOptions } from '@/shared/utils/materialBottomNav/types';
import {
  createMaterialBottomTabNavigator,
  MaterialBottomTabNavigationOptions,
} from 'react-native-paper/react-navigation';
import * as Sentry from 'sentry-expo';

import { AuthProvider } from '@/core/auth';
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
let nhost: NhostClient;

export default function RootLayout() {
  const [isReady, setIsReady] = useState(isSecureStorageInitialized());

  useEffect(() => {
    if (!isSecureStorageInitialized()) {
      getSecureStorageInstance()
        .then((storage) => {
          nhost = new NhostClient({
            ...nhostParams,
            clientStorage: {
              setItem: storage.set.bind(storage),
              getItem: storage.getString.bind(storage),
              removeItem: storage.delete.bind(storage),
            },
            clientStorageType: 'react-native',
          });
          setIsReady(true);
        })
        .catch((err) => {
          console.error('error initializing secure storage', err);
          Sentry.Native.captureException(err);
        });
    }
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
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
