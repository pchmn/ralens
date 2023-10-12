import { $, scalars, typedGql } from '@ralens/core';
import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';

import { Nhost } from '@/utils';

const getEvent = typedGql('query', { scalars })({
  events_by_pk: [
    { id: $('id', 'uuid!') },
    {
      id: true,
    },
  ],
});

export const validatorFormData = validator('form', async (value, c) => {
  // Check file
  const file = value['file[]'];
  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'File is required' });
  }

  // Check event id
  const eventId = c.req.header('x-event-id');
  if (!eventId) {
    throw new HTTPException(400, { message: 'Event id is required' });
  }
  const nhost = Nhost.getInstance(c);
  const res = await nhost.graphql.request(getEvent, { id: eventId });
  if (res.error || !res.data.events_by_pk) {
    throw new HTTPException(404, { message: 'Event not found' });
  }

  return { file, eventId };
});
