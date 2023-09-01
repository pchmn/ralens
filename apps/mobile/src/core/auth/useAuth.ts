import { useAuthenticationStatus, useSignInAnonymous, useUserId } from '@nhost/react';
import { useCallback, useEffect, useState } from 'react';
import * as Sentry from 'sentry-expo';

import { useRegisterDevice } from './useRegisterDevice';

export function useAuth() {
  const { register } = useRegisterDevice();

  const { isAuthenticated, isLoading: authLoading } = useAuthenticationStatus();
  const { signInAnonymous } = useSignInAnonymous();
  const userId = useUserId();

  const [isLoading, setIsLoading] = useState(true);

  const initUser = useCallback(
    async (userId: string) => {
      Sentry.Native.setUser({ id: userId, role: 'anonymous' });
      try {
        await register(userId);
        setIsLoading(false);
      } catch (err) {
        Sentry.Native.captureException(err);
        console.error('nhost err', err);
        setIsLoading(false);
      }
    },
    [register]
  );

  useEffect(() => {
    if (userId) {
      initUser(userId);
    }
  }, [initUser, userId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated && !userId) {
      console.log('useEffect init user signInAnonymous');
      signInAnonymous()
        .then((user) => {
          console.log('signInAnonymous', user);
        })
        .catch((err) => {
          Sentry.Native.captureException(err);
          console.error('nhost err', err);
          setIsLoading(false);
        });
    }
  }, [authLoading, isAuthenticated, signInAnonymous, userId]);

  return { isLoading };
}
