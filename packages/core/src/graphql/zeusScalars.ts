import { ZeusScalars } from './zeus';

export const scalars = ZeusScalars({
  uuid: {
    encode: (e: unknown) => e as string,
    decode: (e: unknown) => e as string,
  },
  timestamptz: {
    decode: (e: unknown) => new Date(e as string),
    encode: (e: unknown) => (e as Date).toISOString(),
  },
  jsonb: {
    decode: (e: unknown) => JSON.parse(e as string) as Record<string, unknown>,
    encode: (e: unknown) => JSON.stringify(e),
  },
});
