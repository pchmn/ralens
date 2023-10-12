/* eslint-disable @typescript-eslint/ban-ts-comment */
import { $, buckets_constraint, scalars, typedGql } from '@ralens/core';
import { HTTPException } from 'hono/http-exception';

import { getContext, getErrorMessage, Nhost } from '@/utils';

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
        id: $('id', 'String!'),
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
  const { error: upsertError } = await nhost.graphql.request(upsertBucket, { id: bucketId });

  if (upsertError) {
    throw new HTTPException(500, {
      message: getErrorMessage(upsertError, { prefix: `Error upserting bucketId ${bucketId}` }),
    });
  }

  const { fileMetadata, error: uploadError } = await nhost.uploadFile(formData);

  if (uploadError) {
    throw new HTTPException(500, {
      message: getErrorMessage(uploadError, {
        prefix: `Error uploading file ${file.name}`,
      }),
    });
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
