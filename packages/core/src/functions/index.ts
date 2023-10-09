import { CreateEventParams, CreateEventSchema } from './createEvent';
import { UploadFileParams, UploadFileSchema } from './uploadFile';

export type FunctionName = keyof FunctionParams;

export type FunctionParams = {
  CreateEvent: CreateEventParams;
  UploadFile: UploadFileParams;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FunctionSchema = {
  CreateEvent: CreateEventSchema,
  UploadFile: UploadFileSchema,
};
