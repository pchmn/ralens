/* eslint-disable @typescript-eslint/no-explicit-any */
import { NhostClient, NhostClientConstructorParams } from '@nhost/nhost-js';
import { Context } from 'hono';
import { env } from 'hono/adapter';

export class Nhost {
  private client: NhostClient;
  private static instance: Nhost;

  private constructor(_params: NhostClientConstructorParams) {
    this.client = new NhostClient(_params);
  }

  static getInstance(c: Context): Nhost {
    if (!Nhost.instance) {
      const { NHOST_AUTH_URL, NHOST_GRAPHQL_URL, NHOST_STORAGE_URL, NHOST_FUNCTIONS_URL, NHOST_ADMIN_SECRET } = env<{
        NHOST_AUTH_URL: string;
        NHOST_GRAPHQL_URL: string;
        NHOST_STORAGE_URL: string;
        NHOST_FUNCTIONS_URL: string;
        NHOST_ADMIN_SECRET: string;
      }>(c);
      Nhost.instance = new Nhost({
        authUrl: NHOST_AUTH_URL,
        graphqlUrl: NHOST_GRAPHQL_URL,
        storageUrl: NHOST_STORAGE_URL,
        functionsUrl: NHOST_FUNCTIONS_URL,
        adminSecret: NHOST_ADMIN_SECRET,
      });
    }

    return Nhost.instance;
  }

  async gql<T, R = any>(query: string, variables: Partial<T>) {
    const res = await Nhost.instance.client.graphql.request(query, {
      data: variables,
    } as any);

    if (res.error) {
      throw res.error;
    }

    return {
      data: Object.values(res.data as any)[0] as R,
    };
  }
}
