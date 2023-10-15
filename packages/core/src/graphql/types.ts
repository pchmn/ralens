import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';

export interface InsertResponse {
  id: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ResultOf<T> = T extends DocumentTypeDecoration<infer ResultType, infer VariablesType> ? ResultType : never;
