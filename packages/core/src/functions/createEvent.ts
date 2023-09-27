import { date, Input, object, string } from 'valibot';

export const CreateEventSchema = object(
  {
    name: string([
      (input) => {
        if (input.length === 0) {
          return {
            issue: {
              validation: 'required',
              message: 'nameRequiredError',
              input,
            },
          };
        }
        return { output: input };
      },
    ]),
    startAt: date(),
    endAt: date(),
  },
  [
    (input) => {
      if (input.startAt >= input.endAt) {
        return {
          issue: {
            validation: 'dateRange',
            message: 'endAtSupStartAtError',
            input: input.endAt,
            path: [
              {
                key: 'endAt',
                value: input,
                input: input.endAt,
                schema: 'object',
              },
            ],
          },
        };
      }
      return { output: input };
    },
  ]
);
export type CreateEventParams = Input<typeof CreateEventSchema>;
