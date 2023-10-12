import { $, scalars, typedGql } from '@ralens/core';
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
    return c.json({ error: 'File is required' }, 400);
  }

  // Check event id
  const eventId = c.req.header('x-event-id');
  if (!eventId) {
    return c.json({ error: 'Event id is required' }, 400);
  }
  const nhost = Nhost.getInstance(c);
  const res = await nhost.graphql.request(getEvent, { id: eventId });
  if (res.error || !res.data.events_by_pk) {
    return c.json({ error: 'Event not found' }, 404);
  }

  return { file, eventId };
});
