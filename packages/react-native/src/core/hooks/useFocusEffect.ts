// eslint-disable-next-line no-restricted-imports
import { useFocusEffect as useFocusEffectRouter } from 'expo-router';
import { DependencyList, EffectCallback, useCallback } from 'react';

export function useFocusEffect(callback: EffectCallback, deps: DependencyList) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffectRouter(useCallback(callback, deps));
}
