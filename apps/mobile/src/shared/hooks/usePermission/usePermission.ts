import { openSettings } from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { PermissionFactory, PermissionModule, PermissionStatus, PermissionType } from './permissions/permissionFactory';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const permissionModules: Record<PermissionType, PermissionModule> = {};

const getPermissionModule = (type: PermissionType) => {
  if (!permissionModules[type]) {
    permissionModules[type] = PermissionFactory.create(type);
  }
  return permissionModules[type];
};

export function usePermission(type: PermissionType) {
  const [status, setStatus] = useState<PermissionStatus>();

  const getStatus = useCallback(async () => {
    const result = await getPermissionModule(type).getStatus();
    setStatus((prev) => (JSON.stringify(prev) !== JSON.stringify(result) ? result : prev));
    return result;
  }, [type]);

  const request = async () => {
    const result = await getPermissionModule(type).request();
    setStatus((prev) => (JSON.stringify(prev) !== JSON.stringify(result) ? result : prev));
    return result;
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        await getStatus();
      }
    });

    getStatus();

    return () => {
      subscription.remove();
    };
  }, [getStatus]);

  return { status, request, getStatus, openSettings };
}
