import { useReducer } from 'react';

export function useToggle(initialValue = false) {
  return useReducer((v) => !v, initialValue);
}
