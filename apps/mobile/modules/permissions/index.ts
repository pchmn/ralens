import { Permission } from 'react-native';

import { PermissionResult } from './src/Permissions.types';
import PermissionsModule from './src/PermissionsModule';

export async function checkPermission(permission: Permission) {
  if (!PermissionsModule) {
    return {
      granted: false,
      canAskAgain: false,
      shouldShowRequestPermissionRationale: false,
    } as PermissionResult;
  }
  return PermissionsModule.checkPermission(permission);
}

export async function requestPermission(permission: Permission) {
  if (!PermissionsModule) {
    return {
      granted: false,
      canAskAgain: false,
      shouldShowRequestPermissionRationale: false,
    } as PermissionResult;
  }
  return PermissionsModule.requestPermission(permission);
}

export { PermissionResult as AndroidPermissionResult };
