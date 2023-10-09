import { CreateEventParams, CreateEventSchema } from './createEvent';

export type FunctionName = keyof FunctionParams | 'UploadFile';

export type FunctionParams = {
  CreateEvent: CreateEventParams;
};

export const FunctionSchema = {
  CreateEvent: CreateEventSchema,
};
