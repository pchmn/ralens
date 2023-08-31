/* eslint-disable react/prop-types */
import { useAppTheme } from '@ralens/react-native';
import { setBackgroundColorAsync as setNavigationBarBackgroundColorAsync } from 'expo-navigation-bar';
import { withLayoutContext } from 'expo-router';
import { useEffect } from 'react';
import {
  createMaterialBottomTabNavigator,
  MaterialBottomTabNavigationOptions,
} from 'react-native-paper/react-navigation';

import {
  FilmIcon,
  FilmOutlineIcon,
  PeopleIcon,
  PeopleOutlineIcon,
  SettingsIcon,
  SettingsOutlineIcon,
} from '@/shared/components';

const { Navigator } = createMaterialBottomTabNavigator();

export const MaterialBottomTabs = withLayoutContext<MaterialBottomTabNavigationOptions, typeof Navigator>(Navigator);

export const unstable_settings = {
  initialRouteName: 'films/index',
};

export default function MainLayout() {
  const theme = useAppTheme();

  useEffect(() => {
    setNavigationBarBackgroundColorAsync(theme.colors.elevation.level2);
  }, [theme]);

  return (
    <>
      <MaterialBottomTabs>
        <MaterialBottomTabs.Screen
          name="films/index"
          options={{
            tabBarLabel: 'Films',
            tabBarIcon(props) {
              return props.focused ? (
                <FilmIcon color={props.color} size={24} />
              ) : (
                <FilmOutlineIcon color={props.color} size={24} />
              );
            },
          }}
        />
        <MaterialBottomTabs.Screen
          name="events/index"
          options={{
            tabBarLabel: 'Events',
            tabBarIcon(props) {
              return props.focused ? (
                <PeopleIcon color={props.color} size={25} />
              ) : (
                <PeopleOutlineIcon color={props.color} size={25} />
              );
            },
          }}
        />
        <MaterialBottomTabs.Screen
          name="settings/index"
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon(props) {
              return props.focused ? (
                <SettingsIcon color={props.color} size={24} />
              ) : (
                <SettingsOutlineIcon color={props.color} size={24} />
              );
            },
          }}
        />
      </MaterialBottomTabs>
      {/* {__DEV__ && <Button onPress={goToSiteMap}>Sitemap</Button>} */}
    </>
  );
}
