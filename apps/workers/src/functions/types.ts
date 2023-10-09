import { FunctionName, FunctionSchema } from '@ralens/core';
import { Context, Env, Input as HonoInput, MiddlewareHandler, ValidationTargets } from 'hono';
import { Input, Output } from 'valibot';

export type Target = keyof ValidationTargets;
type FunctionWithSchema = keyof typeof FunctionSchema;
export type ValidatedBody<Fn extends FunctionWithSchema, T extends Target = 'json'> = {
  in: { [K in T]: Input<typeof FunctionSchema[Fn]> };
  out: { [K in T]: Output<typeof FunctionSchema[Fn]> };
};
export type FunctionContext<Fn extends FunctionName, I extends HonoInput> = Context<Env, Fn, I>;
export type FunctionContextWithSchema<Fn extends FunctionWithSchema> = Context<Env, Fn, ValidatedBody<Fn, 'json'>>;

export type FunctionDefinition<Fn extends FunctionName = FunctionName, I extends HonoInput = HonoInput> = {
  name: Fn;
  handler: (c: FunctionContext<Fn, I>) => Promise<Response>;
  validator?: MiddlewareHandler<Env, Fn, I>;
};

export type FunctionInput<P, T extends Target = 'form'> = {
  in: { [K in T]: P };
  out: { [K in T]: P };
};
