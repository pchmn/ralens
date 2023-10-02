import { useCallback, useState } from 'react';
import { ObjectSchema, ObjectShape, safeParse } from 'valibot';

export function useForm<S extends ObjectShape, T>({
  initialValues,
  schema,
}: {
  initialValues: T;
  schema: ObjectSchema<S, T>;
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<{ [key in keyof Partial<T>]: string }>();

  const handleChange = (value: Partial<T>) => {
    const keys = Object.keys(value) as (keyof T)[];
    for (const errorKey in errors) {
      if (keys.includes(errorKey)) {
        delete errors[errorKey];
      }
    }
    setValues((prev) => ({ ...prev, ...value }));
  };

  const onChange = (key: keyof T, value: T[keyof T]) => {
    const newValue = { ...values, [key]: value } as T;
    setValues(newValue);
  };

  const handleSubmit = (callback?: (values: T) => void) => {
    const result = safeParse(schema, values);
    let validatedValues: T | undefined;

    if (result.success) {
      setErrors(undefined);
      validatedValues = result.output;
      callback?.(result.output);
    } else {
      let errors: { [key in keyof Partial<T>]: string } | undefined;
      result.issues?.forEach((issue) => {
        if (issue.path) {
          errors = errors ?? ({} as { [key in keyof Partial<T>]: string });
          errors[issue.path[0].key as keyof T] = issue.message;
        }
      });
      setErrors(errors);
    }

    return { values: validatedValues, errors, isValid: result.success };
  };

  const reset = useCallback(() => setValues({ ...initialValues }), [initialValues]);

  return { values, setValues: handleChange, onChange, errors, handleSubmit, reset };
}
