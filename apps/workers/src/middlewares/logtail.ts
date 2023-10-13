import { Logtail } from '@logtail/edge';
import { EdgeWithExecutionContext } from '@logtail/edge/dist/es6/edgeWithExecutionContext';
import { Context, MiddlewareHandler, Next } from 'hono';

import { getContext } from '@/utils';

declare module 'hono' {
  interface ContextVariableMap {
    logtail: EdgeWithExecutionContext;
  }
}

let logger: EdgeWithExecutionContext | Console;

function getLogger(c: Context, withUser = true) {
  if (!logger) {
    if (c.env.BETTERSTACK_TOKEN) {
      const client = new Logtail(c.env.BETTERSTACK_TOKEN);
      if (withUser) {
        client.use(async (log) => ({
          ...log,
          userId: getContext(c).currentToken.userId,
        }));
      }
      logger = client.withExecutionContext(c.executionCtx);
    } else {
      logger = console;
    }
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
  const logger = getLogger(c, false);

  const { functionName, request } = await getRequestContext(c);

  await next();

  if (c.error || c.res.status === 401) {
    logger.error(`[${functionName}] Unhautorized`, {
      request,
      context: c.executionCtx,
      error: c.error,
      response: {
        body: await c.res.clone().text(),
        status: c.res.status,
      },
    });
  }
}

async function logAfterJwt(c: Context, next: Next) {
  const logger = getLogger(c);

  const { functionName, request } = await getRequestContext(c);

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

async function getRequestContext(c: Context) {
  const { url, method, path } = c.req;

  const functionName = path.split('/').pop();

  const body = c.req.header('Content-Type') === 'application/json' ? JSON.parse(await c.req.raw.clone().text()) : {};

  const headers: Record<string, string> = {};
  for (const [key, value] of c.req.raw.headers.entries()) {
    if (key === 'authorization' || key === 'cookie') continue;
    headers[key] = value;
  }

  const request = {
    url,
    method,
    body,
    headers,
  };

  return {
    functionName,
    request,
  };
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
