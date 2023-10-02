import { Redirect, usePathname, useRootNavigationState } from 'expo-router';

export default function App() {
  const navigationState = useRootNavigationState();
  const pathname = usePathname();

  console.log('pathname', pathname);

  if (!navigationState?.key) {
    return null;
  }

  return <Redirect href="/films/" />;
}
