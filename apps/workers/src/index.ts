import { Hono } from 'hono';
import { jwt } from 'hono/jwt';

import { functions } from './functions';
import { logtail } from './middlewares';

const app = new Hono();

app.use(
  '*',
  logtail({ preJwt: true }),
  async (c, next) => {
    const handler = jwt({ secret: `${c.env?.NHOST_JWT_SECRET || ''}` });
    return handler(c, next);
  },
  logtail()
);

functions.forEach(({ name, validator, handler }) => {
  if (validator) {
    app.post(`/${name}`, validator, handler);
  } else {
    app.post(`/${name}`, handler);
  }
});

export default app;
