import { vValidator } from '@hono/valibot-validator';
import { $, FunctionSchema, scalars, typedGql } from '@ralens/core';
import { HTTPException } from 'hono/http-exception';

import { getContext, Nhost } from '@/utils';

import { FunctionContextWithSchema, FunctionDefinition } from '../types';

const insertEvent = typedGql('mutation', { scalars })({
  insert_events_one: [
    {
      object: {
        name: $('name', 'String!'),
        startAt: $('startAt', 'timestamptz!'),
        endAt: $('endAt', 'timestamptz!'),
        creatorId: $('creatorId', 'uuid!'),
      },
    },
    {
      id: true,
    },
  ],
});

const insertEventParticipant = typedGql('mutation', { scalars })({
  insert_event_participants_one: [
    {
      object: {
        eventId: $('eventId', 'uuid!'),
        userId: $('userId', 'uuid!'),
        role: $('role', 'String!'),
      },
    },
    {
      eventId: true,
      userId: true,
    },
  ],
});

async function createEvent(c: FunctionContextWithSchema<'CreateEvent'>) {
  const {
    currentToken: { userId },
    body,
  } = getContext(c);
  const nhost = Nhost.getInstance(c);

  try {
    const { data } = await nhost.graphql.request(insertEvent, {
      name: body.name,
      startAt: body.startAt,
      endAt: body.endAt,
      creatorId: userId,
    });

    if (!data?.insert_events_one?.id) {
      throw new Error('Error creating event');
    }

    await nhost.graphql.request(insertEventParticipant, {
      eventId: data.insert_events_one.id,
      userId: userId,
      role: 'creator',
    });

    return c.json({
      id: data?.insert_events_one?.id,
    });
  } catch (err) {
    console.error(JSON.stringify(err, null, 2));
    throw new HTTPException(500, { message: 'Error creating event' });
  }
}

export const createEventFunction: FunctionDefinition = {
  name: 'CreateEvent',
  validator: vValidator('json', FunctionSchema.CreateEvent),
  handler: createEvent,
};
