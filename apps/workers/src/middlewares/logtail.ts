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
    client = new Logtail(c.env.BETTERSTACK_TOKEN || 'mkVeQxAtqHyrr2T3weupfZRS');
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
  return async (c, next) => {
    const logger = getLogger(c);
    const { method, path } = c.req;
    const clonedReq = c.req.raw.clone();
    const body = await clonedReq.text();
    const request = {
      url: c.req.url,
      method: c.req.method,
      body,
    };

    logger.info(`[${method}] ${path}`, {
      request,
    });

    const start = Date.now();

    await next();

    if (c.error) {
      console.log('error, c.error', c.error.name, c.error.message, c.res.status, c.res.body);
      logger.error(`[${method}] ${path}`, {
        request,
        context: c.executionCtx,
        executionTime: time(start),
        error: c.error,
        response: {
          body: c.res.body,
          status: c.res.status,
        },
      });
    } else {
      console.log('success', c.res.status);
      logger.info(`[${method}] ${path}`, {
        request,
        executionTime: time(start),
        response: {
          body: c.res.body,
          status: c.res.status,
        },
      });
    }
  };
}

async function logPrejwt(c: Context, next: Next) {
  const logger = getLogger(c);

  const { url, method, path } = c.req;
  const body = JSON.parse(await c.req.raw.clone().text());
  const request = {
    url,
    method,
    body,
  };

  await next();

  if (c.error && c.res.status === 401) {
    logger.error(`[${path}] Unhautorized`, {
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
  const body = JSON.parse(await c.req.raw.clone().text());
  const request = {
    url,
    method,
    body,
  };

  const start = Date.now();

  logger.info(`[${path}] Call`, {
    request,
  });

  await next();

  if (c.error) {
    logger.error(`[${path}] Error`, {
      request,
      executionTime: time(start),
      error: c.error,
      response: {
        body: JSON.parse(await c.res.clone().text()),
        status: c.res.status,
      },
    });
  } else {
    logger.info(`[${path}] Success`, {
      request,
      executionTime: time(start),
      response: {
        body: JSON.parse(await c.res.clone().text()),
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
