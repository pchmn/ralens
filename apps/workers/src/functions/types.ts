import { FunctionName, FunctionSchema } from '@ralens/core';
import { Context, Env, MiddlewareHandler, ValidationTargets } from 'hono';
import { Input, Output } from 'valibot';

type Target = keyof ValidationTargets;
export type ValidatedBody<Fn extends FunctionName, T extends Target = 'json'> = {
  in: { [K in T]: Input<typeof FunctionSchema[Fn]> };
  out: { [K_1 in T]: Output<typeof FunctionSchema[Fn]> };
};
export type FunctionContext<Fn extends FunctionName, T extends Target = 'json'> = Context<
  Env,
  Fn,
  ValidatedBody<Fn, T>
>;

export type FunctionDefinition<T extends FunctionName = FunctionName> = {
  name: T;
  handler: (c: FunctionContext<T>) => Promise<Response>;
  validator?: MiddlewareHandler<Env, T, ValidatedBody<T>>;
};
