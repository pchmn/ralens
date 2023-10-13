import { Context, Env, Input } from 'hono';

import { Target } from '@/functions/types';

interface DecodedToken {
  userId: string;
  defaultRole: string;
  allowedRoles: string[];
  isAnonymous: boolean;
  sub?: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

export function getCurrentToken(c: Context) {
  const payload = c.get('jwtPayload');
  const hasuraClaims = payload['https://hasura.io/jwt/claims'];

  return {
    userId: hasuraClaims['x-hasura-user-id'] as string,
    defaultRole: hasuraClaims['x-hasura-default-role'] as string,
    allowedRoles: hasuraClaims['x-hasura-allowed-roles'] as string[],
    isAnonymous: hasuraClaims['x-hasura-is-anonymous'] === 'true',
    sub: payload.sub,
    iat: payload.iat,
    exp: payload.exp,
    iss: payload.iss,
  } as DecodedToken;
}

export function getContext<E extends Env, N extends string, P extends Input>(
  c: Context<E, N, P>,
  target: Target = 'json'
) {
  return {
    currentToken: getCurrentToken(c),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: c.req.valid(target as any),
  };
}
