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
