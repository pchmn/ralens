import { vValidator } from '@hono/valibot-validator';
import { Event, INSERT_EVENT, INSERT_EVENT_PARTICIPANT } from '@ralens/core';
import { CreateEventSchema } from '@ralens/core/src/functions/createEvent';
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';

import { getCurrentToken, Nhost } from '@/utils';

const app = new Hono();

let nhost: Nhost;

// const logtail = new Logtail(process.env.BETTERSTACK_TOKEN || 'unknown');

app.use('*', logger(), async (c, next) => {
  if (!nhost) {
    nhost = new Nhost({
      authUrl: c.env?.NHOST_AUTH_URL as string,
      graphqlUrl: c.env?.NHOST_GRAPHQL_URL as string,
      storageUrl: c.env?.NHOST_STORAGE_URL as string,
      functionsUrl: c.env?.NHOST_FUNCTIONS_URL as string,
      adminSecret: c.env?.NHOST_ADMIN_SECRET as string,
    });
  }
  const handler = jwt({ secret: `${c.env?.NHOST_JWT_SECRET || ''}` });
  return handler(c, next);
});

app.post('/CreateEvent', vValidator('json', CreateEventSchema), async (c) => {
  const { userId } = getCurrentToken(c);
  const body = c.req.valid('json');

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
    return c.json({ error: 'Error creating event' }, 500);
  }
});

export default app;
