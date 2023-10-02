import { CameraPermission } from './cameraPermission';
import { MicrophonePermission } from './microphonePermission';
import { PermissionModule, PermissionType } from './types';

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
