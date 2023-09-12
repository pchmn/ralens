import { CameraPermission } from './cameraPermission';
import { MicrophonePermission } from './microphonePermission';

export enum PermissionType {
  CAMERA = 'camera',
  MICROPHONE = 'microphone',
  PHOTO_LIBRARY = 'photoLibrary',
  NOTIFICATION = 'notification',
}

export type PermissionStatus = {
  granted: boolean;
  canAskAgain: boolean;
  shouldShowRequestPermissionRationale?: boolean;
};

export interface PermissionModule {
  type: PermissionType;

  getStatus: () => Promise<PermissionStatus>;

  request: () => Promise<PermissionStatus>;
}

export class PermissionFactory {
  static create(type: PermissionType): PermissionModule {
    switch (type) {
      case 'camera':
        return new CameraPermission();
      case 'microphone':
        return new MicrophonePermission();
      // case 'photoLibrary':
      //   return new PhotoLibraryPermission();
      // case 'notification':
      // return new NotificationPermission();
      default:
        throw new Error(`Permission ${type} is not supported`);
    }
  }
}
