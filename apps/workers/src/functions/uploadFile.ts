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

import { getCurrentToken, Nhost } from '@/utils';

import { FunctionContext, FunctionDefinition } from './types';

async function uploadFile(c: FunctionContext<'UploadFile'>) {
  const { userId } = getCurrentToken(c);
  const eventId = c.req.header('x-event-id');
  const bucketId = eventId || userId;
  const nhost = Nhost.getInstance(c);

  const formData = await c.req.formData();
  await nhost.gql<InsertBucketParams, InsertResponse>(UPSERT_BUCKET, {
    id: bucketId,
  });
  formData.append('bucket-id', bucketId);
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
    id: 'unknonw',
  });
}

export const uploadFileFunction: FunctionDefinition = {
  name: 'UploadFile',
  // validator: vValidator('json', FunctionSchema.UploadFile),
  handler: uploadFile,
};
