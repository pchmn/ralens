import { Logtail } from '@logtail/edge';
import { MiddlewareHandler } from 'hono';

import { getContext } from '@/utils';

export function logtail(): MiddlewareHandler {
  return async (c, next) => {
    const client = new Logtail(c.env.BETTERSTACK_TOKEN || 'unknown');
    client.use(async (log) => ({
      ...log,
      caller: getContext(c).currentToken.userId,
    }));
    const logger = client.withExecutionContext(c.executionCtx);
    const { method, path } = c.req;
    const params = await c.req.json();

    logger.info(`[${method}] ${path}`, {
      params,
    });

    const start = Date.now();

    await next();

    if (c.error) {
      console.log('error');
      logger.error(`[${method}] ${path}`, {
        params,
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
        params,
        executionTime: time(start),
        response: {
          body: c.res.body,
          status: c.res.status,
        },
      });
    }
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
