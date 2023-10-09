/* eslint-disable @typescript-eslint/no-explicit-any */
import { Buffer } from 'node:buffer';

import { NhostClient, NhostClientConstructorParams } from '@nhost/nhost-js';
import { Context } from 'hono';
import { env } from 'hono/adapter';

export class Nhost {
  private client: NhostClient;
  private static instance: Nhost;
  private authorizationHeader: string;

  private constructor(_params: NhostClientConstructorParams, _authorizationHeader: string) {
    this.client = new NhostClient(_params);
    this.authorizationHeader = _authorizationHeader;
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
      Nhost.instance = new Nhost(
        {
          authUrl: NHOST_AUTH_URL,
          graphqlUrl: NHOST_GRAPHQL_URL,
          storageUrl: NHOST_STORAGE_URL,
          functionsUrl: NHOST_FUNCTIONS_URL,
          adminSecret: NHOST_ADMIN_SECRET,
        },
        c.req.header('Authorization') || ''
      );
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

  async uploadFile({ name, content, type }: { name: string; content: string; type: string }) {
    const formData = new FormData();
    const bf = Buffer.from(content, 'base64');
    const fileToSend = new File([bf], name, { type });
    formData.append('file', fileToSend, name);

    const headers = {
      // 'x-hasura-admin-secret': `${this.client.adminSecret}`,
      Authorization: `${this.authorizationHeader}`,
    };

    const res = await fetch('https://local.storage.nhost.run/v1/files', {
      method: 'POST',
      body: formData,
      headers,
    });

    const body = await res.json();

    return {
      id: (body as any).id as string,
    };
  }
}
