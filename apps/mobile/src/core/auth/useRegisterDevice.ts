import { useMutation } from '@apollo/client';
import { useUserData } from '@nhost/react';
import {
  $,
  Installation,
  installations_constraint,
  installations_update_column,
  ResultOf,
  scalars,
  typedGql,
} from '@ralens/core';
import { useEffectOnce } from '@ralens/react-native';
import messaging from '@react-native-firebase/messaging';
import { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';

import { getDeviceInstallation } from './utils';

const upsertInstallation = typedGql('mutation', { scalars: scalars })({
  insert_installations_one: [
    {
      object: {
        id: $('id', 'uuid!'),
        userId: $('userId', 'uuid!'),
        deviceName: $('deviceName', 'String'),
        osName: $('osName', 'String'),
        osVersion: $('osVersion', 'String'),
        pushToken: $('pushToken', 'String'),
        appVersion: $('appVersion', 'String'),
        appIdentifier: $('appIdentifier', 'String'),
        deviceType: $('deviceType', 'String'),
        deviceLocale: $('deviceLocale', 'String'),
      },
      on_conflict: {
        constraint: installations_constraint.installations_pkey,
        update_columns: [
          installations_update_column.deviceName,
          installations_update_column.osName,
          installations_update_column.osVersion,
          installations_update_column.pushToken,
          installations_update_column.appVersion,
          installations_update_column.appIdentifier,
          installations_update_column.deviceType,
          installations_update_column.deviceLocale,
        ],
      },
    },
    { id: true },
  ],
});

export function useRegisterDevice() {
  const userData = useUserData();
  const [upsert] = useMutation<ResultOf<typeof upsertInstallation>, Partial<Installation>>(upsertInstallation);

  const register = useCallback(
    async (userId: string) => {
      const installation = await getDeviceInstallation();
      await upsert({ variables: { userId, ...installation } });
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
