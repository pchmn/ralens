import { createEventFunction } from './createEvent';
import { FunctionDefinition } from './types';
import { uploadFileFunction } from './uploadFile';

export const functions: FunctionDefinition[] = [createEventFunction, uploadFileFunction];
