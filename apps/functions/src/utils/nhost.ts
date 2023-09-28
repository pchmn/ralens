/* eslint-disable @typescript-eslint/no-explicit-any */
import { NhostClient, NhostClientConstructorParams } from '@nhost/nhost-js';

export class Nhost {
  public client: NhostClient;

  constructor(_params: NhostClientConstructorParams) {
    this.client = new NhostClient(_params);
  }

  async gql<T, R = any>(query: string, variables: Partial<T>) {
    const res = await this.client.graphql.request(query, {
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
