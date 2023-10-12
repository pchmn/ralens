/* eslint-disable @typescript-eslint/ban-ts-comment */
import { $, buckets_constraint, scalars, typedGql } from '@ralens/core';

import { getContext, Nhost } from '@/utils';

import { FunctionContext, FunctionDefinition, FunctionInput } from '../types';
import { validatorFormData } from './validator';

type UploadFileInput = {
  file: File;
  eventId: string;
};

// @ts-ignore
const upsertBucket = typedGql('mutation', { scalars })({
  insertBucket: [
    {
      object: {
        id: $('id', 'uuid!'),
      },
      on_conflict: { constraint: buckets_constraint.buckets_pkey, update_columns: [] },
    },
    {
      id: true,
    },
  ],
});

const insertUserFile = typedGql('mutation', { scalars })({
  insert_event_files_one: [
    {
      object: {
        fileId: $('fileId', 'uuid!'),
        userId: $('userId', 'uuid!'),
      },
    },
    {
      fileId: true,
      userId: true,
    },
  ],
});

const insertEventFile = typedGql('mutation', { scalars })({
  insert_event_files_one: [
    {
      object: {
        eventId: $('eventId', 'uuid!'),
        fileId: $('fileId', 'uuid!'),
        userId: $('userId', 'uuid!'),
      },
    },
    {
      eventId: true,
      fileId: true,
      userId: true,
    },
  ],
});

async function uploadFile(c: FunctionContext<'UploadFile', FunctionInput<UploadFileInput>>) {
  const {
    currentToken: { userId },
    body: { file, eventId },
  } = getContext(c, 'form');
  const bucketId = eventId || userId;
  const nhost = Nhost.getInstance(c);
  const logger = c.get('logtail');

  const formData = new FormData();
  formData.append('file[]', file);
  formData.append('bucket-id', bucketId);
  // @ts-ignore
  await nhost.graphql.request(upsertBucket, { id: bucketId });
  const { fileMetadata, error } = await nhost.uploadFile(formData);

  if (error) {
    throw error;
  }

  logger.info('[UploadFile] File uploaded', {
    fileMetadata,
    userId,
    eventId,
  });

  await nhost.graphql.request(insertUserFile, {
    fileId: fileMetadata.id,
    userId,
  });
  if (eventId) {
    await nhost.graphql.request(insertEventFile, {
      eventId: eventId,
      fileId: fileMetadata.id,
      userId,
    });
  }
  await nhost.graphql.request(insertEventFile, {
    eventId: eventId,
    fileId: fileMetadata.id,
    userId,
  });

  return c.json({
    id: fileMetadata.id,
  });
}

export const uploadFileFunction: FunctionDefinition<'UploadFile', FunctionInput<UploadFileInput>> = {
  name: 'UploadFile',
  validator: validatorFormData,
  handler: uploadFile,
};
