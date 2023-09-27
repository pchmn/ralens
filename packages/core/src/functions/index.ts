import { CreateEventParams, CreateEventSchema } from './createEvent';

export type FunctionName = keyof FunctionParams;

export type FunctionParams = {
  CreateEvent: CreateEventParams;
};

export const FunctionSchema = {
  CreateEvent: CreateEventSchema,
};
