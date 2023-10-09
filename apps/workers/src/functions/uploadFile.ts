import {
  INSERT_EVENT_FILE,
  INSERT_USER_FILE,
  InsertBucketParams,
  InsertEventFileParams,
  InsertEventFileResponse,
  InsertResponse,
  UPSERT_BUCKET,
  UserFile,
} from '@ralens/core';
import { validator } from 'hono/validator';

import { getContext, Nhost } from '@/utils';

import { FunctionContext, FunctionDefinition, FunctionInput } from './types';

async function uploadFile(c: FunctionContext<'UploadFile', FunctionInput<{ file: File; eventId: string }>>) {
  const {
    currentToken: { userId },
    body: { file, eventId },
  } = getContext(c, 'form');
  const bucketId = eventId || userId;
  const nhost = Nhost.getInstance(c);

  const formData = new FormData();
  formData.append('file[]', file);
  formData.append('bucket-id', bucketId);
  await nhost.gql<InsertBucketParams, InsertResponse>(UPSERT_BUCKET, {
    id: bucketId,
  });
  const { fileMetadata, error } = await nhost.uploadFile(formData);

  if (error) {
    throw error;
  }

  await nhost.gql<UserFile, UserFile>(INSERT_USER_FILE, {
    fileId: fileMetadata.id,
    userId,
  });
  if (eventId) {
    await nhost.gql<InsertEventFileParams, InsertEventFileResponse>(INSERT_EVENT_FILE, {
      eventId: eventId,
      fileId: fileMetadata.id,
      userId,
    });
  }

  return c.json({
    id: fileMetadata.id,
  });
}

const validatorFormData = validator('form', (value, c) => {
  const file = value['file[]'];
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'File is required' }, 400);
  }
  if (!c.req.header('x-event-id')) {
    return c.json({ error: 'Event id is required' }, 400);
  }
  return { file, eventId: c.req.header('x-event-id') };
});

export const uploadFileFunction: FunctionDefinition<'UploadFile', FunctionInput<{ file: File; eventId: string }>> = {
  name: 'UploadFile',
  validator: validatorFormData,
  handler: uploadFile,
};
