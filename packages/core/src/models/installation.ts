import { User } from '@nhost/nhost-js';

import { BaseModel } from './base';

export type DeviceType = 'phone' | 'tablet' | 'desktop' | 'tv';

export interface Installation extends BaseModel {
  deviceName: string;
  osName?: string;
  osVersion?: string;
  pushToken: string;
  isActive: boolean;
  user: User;
  userId: string;
  appVersion?: string;
  appIdentifier?: string;
  deviceType?: DeviceType;
  deviceLocale: string;
}
