import { checkPermission, requestPermission } from '@modules/permissions';
import { PermissionsAndroid, Platform } from 'react-native';
import { Camera } from 'react-native-vision-camera';

import { PermissionModule, PermissionType } from './types';

export class CameraPermission implements PermissionModule {
  type = PermissionType.CAMERA;

  async getStatus() {
    if (Platform.OS === 'android') {
      return checkPermission(PermissionsAndroid.PERMISSIONS.CAMERA);
    }
    const status = await Camera.getCameraPermissionStatus();
    return { granted: status === 'authorized', canAskAgain: status !== 'denied' };
  }

  async request() {
    if (Platform.OS === 'android') {
      return requestPermission(PermissionsAndroid.PERMISSIONS.CAMERA);
    }
    const status = await Camera.requestCameraPermission();
    return { granted: status === 'authorized', canAskAgain: status !== 'denied' };
  }
}
