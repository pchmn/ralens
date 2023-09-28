import { Logtail } from '@logtail/node';
import { Event, INSERT_EVENT, INSERT_EVENT_PARTICIPANT } from '@ralens/core';
import { APIGatewayEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

import { Nhost } from '@/utils/nhost';
import { validateRequest } from '@/utils/validateRequest';

const nhost = new Nhost({
  authUrl: process.env.NHOST_AUTH_URL,
  graphqlUrl: process.env.NHOST_GRAPHQL_URL,
  storageUrl: process.env.NHOST_STORAGE_URL,
  functionsUrl: process.env.NHOST_FUNCTIONS_URL,
  adminSecret: process.env.NHOST_ADMIN_SECRET,
});

const logtail = new Logtail(process.env.BETTERSTACK_TOKEN || 'unknown');

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  const { currentToken, body } = validateRequest('CreateEvent', event, context);

  try {
    const { data } = await nhost.gql<Event, { id: string }>(INSERT_EVENT, {
      name: body.name,
      startAt: body.startAt,
      endAt: body.endAt,
      creatorId: currentToken.userId,
    });

    await nhost.gql(INSERT_EVENT_PARTICIPANT, {
      eventId: data.id,
      userId: currentToken.userId,
      role: 'creator',
    });

    logtail.info('[create-event] Event created', {
      params: { from: currentToken.userId, ...body },
      eventId: data.id,
      executionTime: `${Date.now() - startTime}ms`,
      awsLogs: {
        logStream: context.logStreamName,
        requestId: context.awsRequestId,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        id: data.id,
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logtail.error('[create-event] Error creating event', {
      error: JSON.stringify(error, null, 2),
      params: {
        from: currentToken.userId,
        ...body,
        awsLogs: {
          logStream: context.logStreamName,
          requestId: context.awsRequestId,
        },
      },
    });
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
};
