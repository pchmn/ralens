/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line no-restricted-imports
import { gql, OperationVariables, useSubscription as useApolloSubscription } from '@apollo/client';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { DocumentNode } from 'graphql';
import { useState } from 'react';

export function useSubscription<T, P = OperationVariables>(
  mutation: string | DocumentNode | TypedDocumentNode<T>,
  options?: P
) {
  const [result, setResult] = useState<T>();

  const { data, loading, error } = useApolloSubscription<T>(typeof mutation === 'string' ? gql(mutation) : mutation, {
    variables: options as OperationVariables,
  });

  if (!loading && JSON.stringify(Object.values(data as any)[0]) !== JSON.stringify(result)) {
    setResult(Object.values(data as any)[0] as T);
  }

  return {
    data: result,
    loading,
    error,
  };
}
