import { Material3Scheme, useMaterial3Theme } from '@pchmn/expo-material3-theme';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  Theme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import {
  adaptNavigationTheme,
  MD3DarkTheme,
  MD3LightTheme,
  Provider as PaperProvider,
  // eslint-disable-next-line no-restricted-imports
  useTheme,
} from 'react-native-paper';
import { MD3Theme, ThemeProp } from 'react-native-paper/lib/typescript/types';

import { Flex } from './components/Flex';

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

type ColorScheme = 'light' | 'dark';

interface UiProviderProps {
  baseColor?: string;
  colorScheme?: ColorScheme;
  toggleColorScheme?: (colorScheme?: ColorScheme) => void;
  changeBaseColor?: (color: string) => void;
  theme?: ThemeProp;
  navigationTheme?: Theme;
}

const UiProviderContext = createContext<UiProviderProps>({} as UiProviderProps);

export function useUiProviderContext() {
  const ctx = useContext(UiProviderContext);
  if (!ctx) {
    throw new Error('useUiProviderContext must be used inside UiProvider');
  }
  return ctx;
}

export function UiProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useMaterial3Theme({ fallbackSourceColor: '#FFD9DA' });

  const colorScheme = useColorScheme();

  const paperTheme = useMemo(
    () =>
      colorScheme === 'dark' ? { ...MD3DarkTheme, colors: theme.dark } : { ...MD3LightTheme, colors: theme.light },
    [colorScheme, theme]
  );

  const navigationTheme: Theme = useMemo(
    () =>
      colorScheme === 'dark'
        ? {
            ...DarkTheme,
            ...MD3DarkTheme,
            colors: { ...DarkTheme.colors, ...theme.dark },
            mode: 'adaptive',
          }
        : { ...LightTheme, ...MD3LightTheme, colors: { ...LightTheme.colors, ...theme.light } },
    [colorScheme, theme]
  );

  useEffect(() => {
    NavigationBar.setPositionAsync('absolute');
    NavigationBar.setButtonStyleAsync(colorScheme === 'dark' ? 'light' : 'dark');
  }, [colorScheme]);

  return (
    <UiProviderContext.Provider value={{ colorScheme: colorScheme || undefined, theme: paperTheme, navigationTheme }}>
      <PaperProvider theme={paperTheme}>
        <StatusBar
          barStyle={paperTheme.dark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        <NavigationThemeProvider value={navigationTheme}>
          <Flex flex={1}>{children}</Flex>
        </NavigationThemeProvider>
      </PaperProvider>
    </UiProviderContext.Provider>
  );
}

export const useAppTheme = useTheme<MD3Theme & { colors: Material3Scheme }>;
