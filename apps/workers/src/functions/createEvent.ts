import { vValidator } from '@hono/valibot-validator';
import { Event, FunctionSchema, INSERT_EVENT, INSERT_EVENT_PARTICIPANT } from '@ralens/core';
import { HTTPException } from 'hono/http-exception';

import { getContext, Nhost } from '@/utils';

import { FunctionContext, FunctionDefinition } from './types';

async function createEvent(c: FunctionContext<'CreateEvent'>) {
  const {
    currentToken: { userId },
    body,
  } = getContext(c);
  const nhost = Nhost.getInstance(c);

  try {
    const { data } = await nhost.gql<Event, { id: string }>(INSERT_EVENT, {
      name: body.name,
      startAt: body.startAt,
      endAt: body.endAt,
      creatorId: userId,
    });

    await nhost.gql(INSERT_EVENT_PARTICIPANT, {
      eventId: data.id,
      userId: userId,
      role: 'creator',
    });

    return c.json({
      id: data.id,
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
