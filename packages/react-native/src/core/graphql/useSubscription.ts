/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line no-restricted-imports
import { gql, OperationVariables, useSubscription as useApolloSubscription } from '@apollo/client';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { DocumentNode } from 'graphql';
import { useState } from 'react';

function mapResults<I = any, O = any>(data: I) {
  return Object.values(data as any)[0] as O;
}

export function useSubscription<T, I = any, V extends OperationVariables = OperationVariables>(
  mutation: string | DocumentNode | TypedDocumentNode<T>,
  options?: {
    variables?: V;
    mapFn?: (data: I) => T;
  }
) {
  const { variables, mapFn = mapResults } = options || {};
  const [result, setResult] = useState<T>();

  const { data, loading, error } = useApolloSubscription<I>(typeof mutation === 'string' ? gql(mutation) : mutation, {
    variables,
  });

  if (!loading) {
    if (data && JSON.stringify(mapFn(data)) !== JSON.stringify(result)) {
      setResult(mapFn(data));
    } else if (data === undefined && result !== undefined) {
      setResult(undefined);
    }
  }

  return {
    data: result,
    loading,
    error,
  };
}
