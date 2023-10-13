export const UPSERT_BUCKET = `
  mutation insertBucket($data: buckets_insert_input!) {
    insertBucket(object: $data, on_conflict: {constraint: buckets_pkey}) {
      id
    }
  }
`;
export interface InsertBucketParams {
  id: string;
}
