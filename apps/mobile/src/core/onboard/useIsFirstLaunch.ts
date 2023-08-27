import { useSecureStorage } from '@ralens/react-native';

export function useIsFirstLaunch() {
  return useSecureStorage<boolean>('isFirstLaunch', true);
}
