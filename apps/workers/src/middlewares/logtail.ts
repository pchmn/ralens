import { Logtail } from '@logtail/edge';
import { EdgeWithExecutionContext } from '@logtail/edge/dist/es6/edgeWithExecutionContext';
import { Context, MiddlewareHandler, Next } from 'hono';

import { getContext } from '@/utils';

declare module 'hono' {
  interface ContextVariableMap {
    logtail: EdgeWithExecutionContext;
  }
}

let client: Logtail;
let logger: EdgeWithExecutionContext;

function getLogger(c: Context, withUser = true) {
  if (!client) {
    client = new Logtail(c.env.BETTERSTACK_TOKEN || 'unknown');
    if (withUser) {
      client.use(async (log) => ({
        ...log,
        userId: getContext(c).currentToken.userId,
      }));
    }
    logger = client.withExecutionContext(c.executionCtx);
  }
  c.set('logtail', logger);
  return logger;
}

interface LogtailOptions {
  preJwt: boolean;
}

export function logtail(options?: LogtailOptions): MiddlewareHandler {
  if (options?.preJwt) {
    return logPrejwt;
  }
  return logAfterJwt;
}

async function logPrejwt(c: Context, next: Next) {
  const logger = getLogger(c);

  const { url, method, path } = c.req;
  const functionName = path.split('/').pop();
  const body = c.req.header('Content-Type') === 'application/json' ? JSON.parse(await c.req.raw.clone().text()) : {};
  const request = {
    url,
    method,
    body,
  };

  await next();

  if (c.error && c.res.status === 401) {
    logger.error(`[${functionName}] Unhautorized`, {
      request,
      context: c.executionCtx,
      error: c.error,
      response: {
        body: JSON.parse(await c.res.clone().text()),
        status: c.res.status,
      },
    });
  }
}

async function logAfterJwt(c: Context, next: Next) {
  const logger = getLogger(c);

  const { url, method, path } = c.req;
  const functionName = path.split('/').pop();
  const body = c.req.header('Content-Type') === 'application/json' ? JSON.parse(await c.req.raw.clone().text()) : {};
  const request = {
    url,
    method,
    body,
  };

  const start = Date.now();

  logger.info(`[${functionName}] Call`, {
    request,
  });

  await next();

  const text = await c.res.clone().text();
  if (c.error) {
    logger.error(`[${functionName}] Error`, {
      request,
      executionTime: time(start),
      error: c.error,
      response: {
        body: text,
        status: c.res.status,
      },
    });
  } else {
    logger.info(`[${functionName}] Success`, {
      request,
      executionTime: time(start),
      response: {
        body: text,
        status: c.res.status,
      },
    });
  }
}

const humanize = (times: string[]) => {
  const [delimiter, separator] = [',', '.'];

  const orderTimes = times.map((v) => v.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + delimiter));

  return orderTimes.join(separator);
};

const time = (start: number) => {
  const delta = Date.now() - start;
  return humanize([delta < 1000 ? delta + 'ms' : Math.round(delta / 1000) + 's']);
};
