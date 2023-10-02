import { CreateEventParams, CreateEventSchema } from './createEvent';

export type FunctionName = keyof FunctionParams;

export type FunctionParams = {
  CreateEvent: CreateEventParams;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FunctionSchema = {
  CreateEvent: CreateEventSchema,
};
