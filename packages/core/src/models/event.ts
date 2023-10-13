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
  participants: EventParticipant[];
}

export interface EventParticipant extends BaseModel<false> {
  eventId: string;
  userId: string;
  user: User;
  role: 'participant' | 'editor' | 'owner';
}

export interface EventFile extends BaseModel<false> {
  eventId: string;
  fileId: string;
  userId: string;
}
