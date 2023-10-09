import { Input, object, optional, string } from 'valibot';

export const UploadFileSchema = object({
  file: object({
    name: string(),
    content: string(),
    type: string(),
  }),
  bucketId: optional(string()),
  eventId: optional(string()),
});
export type UploadFileParams = Input<typeof UploadFileSchema>;
