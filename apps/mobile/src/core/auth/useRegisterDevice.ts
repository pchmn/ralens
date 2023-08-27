import { useUserData } from '@nhost/react';
import { Installation, UPSERT_INSTALLATION } from '@prevezic/core';
import { useEffectOnce, useInsertMutation } from '@prevezic/react-native';
import messaging from '@react-native-firebase/messaging';
import { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';

import { getDeviceInstallation } from './utils';

export function useRegisterDevice() {
  const userData = useUserData();
  const [upsert] = useInsertMutation<Installation>(UPSERT_INSTALLATION);

  const register = useCallback(
    async (userId: string) => {
      const installation = await getDeviceInstallation();
      await upsert({ id: installation.id, userId, ...installation });
    },
    [upsert]
  );

  useEffectOnce(() => {
    const unsubscribe = messaging().onTokenRefresh(async () => {
      if (userData) await register(userData.id);
    });

    return unsubscribe;
  });

  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (message) => {
      Alert.alert('A new FCM message arrived!', JSON.stringify(message));
    });

    return unsubscribe;
  }, []);

  return { register };
}
