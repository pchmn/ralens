/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApolloError, gql, OperationVariables, SubscriptionHookOptions, useApolloClient } from '@apollo/client';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { DocumentNode } from 'graphql';
import { useState } from 'react';

import { useFocusEffect } from '../hooks';

function mapResults<I = any, O = any>(data: I) {
  return Object.values(data as any)[0] as O;
}

export function useSubscription<T, R = T, I = any, V extends OperationVariables = OperationVariables>(
  mutation: string | DocumentNode | TypedDocumentNode<T, V>,
  options?: SubscriptionHookOptions & {
    mapFn?: (data: I) => R;
  }
) {
  const client = useApolloClient();

  const { variables, mapFn = mapResults } = options || {};

  const [result, setResult] = useState<R>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApolloError>();

  useFocusEffect(() => {
    const subscribe = client.subscribe<I>({
      query: typeof mutation === 'string' ? gql(mutation) : mutation,
      variables,
    });

    const subscription = subscribe.subscribe(
      ({ data }) => {
        setLoading(false);
        if ((data === undefined || data === null) && result !== undefined) {
          setResult(undefined);
        } else if (data) {
          const newResult = mapFn(data);
          if (JSON.stringify(newResult) !== JSON.stringify(result)) {
            setResult(newResult);
          }
        }
      },
      (error) => {
        setError(error);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    data: result,
    loading,
    error,
  };
}
