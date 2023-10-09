/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNhostClient } from '@nhost/react';
import { FunctionParams } from '@ralens/core';

interface NhostFunctionCallConfig {
  headers?: Record<string, string>;
}

export function useNhostFunctions() {
  const nhost = useNhostClient();

  const call = async <T extends keyof FunctionParams, R = any>(
    name: T,
    params: FunctionParams[T],
    config?: NhostFunctionCallConfig
  ) => {
    const { res, error } = await nhost.functions.call(name, params, config);
    if (error) {
      throw error;
    }

    return {
      data: Object.values(res.data as any)[0] as R,
    };
  };

  return {
    call,
  };
}
