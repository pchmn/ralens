/* eslint-disable react/prop-types */
import { useAppTheme } from '@ralens/react-native';
import { withLayoutContext } from 'expo-router';
import { useRef } from 'react';
import { Animated, View } from 'react-native';
import { TouchableRipple } from 'react-native-paper';
import {
  createMaterialBottomTabNavigator,
  MaterialBottomTabNavigationOptions,
} from 'react-native-paper/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export const BOTTOM_TABS_HEIGHT = 80;
const tabRoutes = ['films/index', 'events/index', 'settings/index'];

export default function MainLayout() {
  const theme = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const translateAnim = useRef(new Animated.Value(0)).current;

  const toggleTabBar = (show: boolean) => {
    Animated.timing(translateAnim, {
      toValue: show ? 0 : BOTTOM_TABS_HEIGHT + bottom,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  return (
    <>
      <MaterialBottomTabs
        sceneAnimationEnabled
        sceneAnimationType="shifting"
        backBehavior="history"
        theme={theme}
        screenOptions={({ navigation }) => {
          const state = navigation.getState();
          const currentRoute = state.routeNames[state.index];
          toggleTabBar(tabRoutes.includes(currentRoute));

          return {
            tabBarStyle: {
              transform: [{ translateY: translateAnim }],
              position: 'absolute',
              // display: tabRoutes.includes(currentRoute) ? 'flex' : 'none',
            },
          };
        }}
        renderTouchable={(props) => <Touchable {...props} />}
      >
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Touchable = ({ route, style, children, centered, ...rest }: any) => {
  const theme = useAppTheme();

  return !tabRoutes.includes(route.name) ? null : (
    <View {...rest} style={[style, { overflow: 'hidden', height: BOTTOM_TABS_HEIGHT }]}>
      <TouchableRipple
        onPress={rest.onPress}
        rippleColor={theme.dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}
        borderless
        centered={centered}
        style={{
          position: 'absolute',
          top: -20,
          left: 0,
          right: 0,
          bottom: -20,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 80,
        }}
      >
        {children}
      </TouchableRipple>
    </View>
  );
};
