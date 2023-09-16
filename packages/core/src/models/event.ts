import { User } from '@nhost/nhost-js';

import { BaseModel } from './base';

export interface Event extends BaseModel {
  name: string;
  slug: string;
  creatorId: string;
  creator: User;
  startAt: Date;
  endAt: Date;
  params: unknown;
}
