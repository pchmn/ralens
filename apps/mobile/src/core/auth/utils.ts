import { Installation } from '@ralens/core';
import { getSecureStorageInstance } from '@ralens/react-native';
import messaging from '@react-native-firebase/messaging';
import * as Application from 'expo-application';
import { randomUUID } from 'expo-crypto';
import * as Device from 'expo-device';

import { getDeviceLocale } from '../i18n';

export async function getDeviceInstallation(): Promise<Partial<Installation>> {
  const installationId = await getInstallationId();
  let pushToken: string | undefined;
  try {
    pushToken = await messaging().getToken();
    return {
      id: installationId,
      deviceName: `${Device.manufacturer} ${Device.modelName}`,
      osName: Device.osName || undefined,
      osVersion: Device.osVersion || undefined,
      pushToken: pushToken,
      appVersion: Application.nativeApplicationVersion || undefined,
      appIdentifier: Application.applicationId || undefined,
      deviceType: getDeviceType(Device.deviceType),
      deviceLocale: getDeviceLocale(),
    };
  } catch (err) {
    console.error('Error getting pushToken', err);
    throw err;
  }
}

function getDeviceType(expoDeviceType: Device.DeviceType | null) {
  switch (expoDeviceType) {
    case Device.DeviceType.PHONE:
      return 'phone';
    case Device.DeviceType.TABLET:
      return 'tablet';
    case Device.DeviceType.DESKTOP:
      return 'desktop';
    case Device.DeviceType.TV:
      return 'tv';
    default:
      return undefined;
  }
}

async function getInstallationId() {
  const storage = await getSecureStorageInstance();
  const installationId = storage.getString('installationId');
  if (installationId) {
    return installationId;
  }

  const newInstallationId = randomUUID();
  storage.set('installationId', newInstallationId);
  return newInstallationId;
}
