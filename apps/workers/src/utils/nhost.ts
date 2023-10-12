/* eslint-disable @typescript-eslint/no-explicit-any */

import { NhostGraphqlClient } from '@nhost/graphql-js';
import { HasuraAuthClient, NhostClient, NhostClientConstructorParams } from '@nhost/nhost-js';
import { Context } from 'hono';
import { env } from 'hono/adapter';

export class Nhost {
  private static instance: Nhost;

  public graphql: NhostGraphqlClient;
  public auth: HasuraAuthClient;
  private authorizationHeader: string;

  private constructor(_params: NhostClientConstructorParams, _authorizationHeader: string) {
    const client = new NhostClient(_params);
    this.graphql = client.graphql;
    this.auth = client.auth;
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

  async gql<T, R = any>(query: string, variables: T) {
    const res = await Nhost.instance.graphql.request(query, {
      data: variables,
    } as any);

    if (res.error) {
      throw res.error;
    }

    return {
      data: Object.values(res.data as any)[0] as R,
    };
  }

  async uploadFile(formData: FormData) {
    const headers = {
      Authorization: `${this.authorizationHeader}`,
    };

    const response = await fetch('https://local.storage.nhost.run/v1/files', {
      method: 'POST',
      body: formData,
      headers,
    });

    const responseData = (await response.json()) as StorageUploadFormDataResponse;

    if (!response.ok) {
      const error: StorageErrorPayload = {
        status: response.status,
        message: responseData?.error?.message || response.statusText,
        error: response.statusText,
      };
      return { error, fileMetadata: null };
    }
    return { fileMetadata: responseData.processedFiles?.[0] as FileResponse, error: null };
  }
}

export type StorageUploadFormDataResponse =
  | { processedFiles: FileResponse[]; error: null }
  | { processedFiles: null; error: StorageErrorPayload };

export interface FileResponse {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  etag: string;
  createdAt: string;
  bucketId: string;
  isUploaded: true;
  updatedAt: string;
  uploadedByUserId: string;
}

export interface StorageErrorPayload {
  error: string;
  status: number;
  message: string;
}
