import { hideAsync } from 'expo-splash-screen';
import { createContext } from 'react';

import { useAuth } from './useAuth';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AuthContextProps {}

const AuthContext = createContext<AuthContextProps>({} as AuthContextProps);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  // Hide splash screen
  hideAsync();

  return <AuthContext.Provider value={{}}>{children}</AuthContext.Provider>;
}
