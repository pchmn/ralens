import { ErrorPayload } from '@nhost/nhost-js';
import { GraphQLError } from 'graphql';

export function getErrorMessage(error: ErrorPayload | GraphQLError[], options?: { prefix?: string }) {
  const { prefix } = options || {};

  if (error instanceof Array) {
    return `${prefix ? `${prefix}: ` : ''}${error.map((e) => e.message).join(', ')}`;
  }
  return `${prefix ? `${prefix}: ` : ''}${error.message}`;
}
