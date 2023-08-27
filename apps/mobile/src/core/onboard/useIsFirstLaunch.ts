import { useSecureStorage } from '@prevezic/react-native';

export function useIsFirstLaunch() {
  return useSecureStorage<boolean>('isFirstLaunch', true);
}
