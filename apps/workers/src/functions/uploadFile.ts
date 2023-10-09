import { vValidator } from '@hono/valibot-validator';
import {
  FunctionSchema,
  INSERT_EVENT_FILE,
  INSERT_USER_FILE,
  InsertEventFileParams,
  InsertEventFileResponse,
  UserFile,
} from '@ralens/core';

import { getContext, Nhost } from '@/utils';

import { FunctionContext, FunctionDefinition } from './types';

async function uploadFile(c: FunctionContext<'UploadFile'>) {
  const {
    currentToken: { userId },
    body: { file, eventId },
  } = getContext(c);
  const nhost = Nhost.getInstance(c);

  const { id } = await nhost.uploadFile({ ...file, type: 'image/jpeg' });

  await nhost.gql<UserFile, UserFile>(INSERT_USER_FILE, {
    fileId: id,
    userId,
  });
  if (eventId) {
    await nhost.gql<InsertEventFileParams, InsertEventFileResponse>(INSERT_EVENT_FILE, {
      eventId: eventId,
      fileId: id,
      userId,
    });
  }

  return c.json({
    id: 'unknonw',
  });
}

export const uploadFileFunction: FunctionDefinition = {
  name: 'UploadFile',
  validator: vValidator('json', FunctionSchema.UploadFile),
  handler: uploadFile,
};
