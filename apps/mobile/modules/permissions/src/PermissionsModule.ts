import { requireNativeModule } from 'expo-modules-core';

import { PermissionResult as PermissionResult } from './Permissions.types';

let PermissionsModule:
  | {
      checkPermission: (permission: string) => Promise<PermissionResult>;
      requestPermission: (permission: string) => Promise<PermissionResult>;
    }
  | undefined = undefined;
try {
  PermissionsModule = requireNativeModule('AndroidPermissions');
} catch {
  /* empty */
}
export default PermissionsModule;
