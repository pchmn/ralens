import 'dotenv/config';

import { ExpoConfig } from '@expo/config';

const name =
  process.env.APP_ENV === 'production'
    ? 'Ralens'
    : process.env.APP_ENV === 'development'
    ? 'RalensDev'
    : process.env.APP_ENV === 'preview'
    ? 'RalensPreview'
    : 'RalensLocal';

const appIdentifier =
  process.env.APP_ENV === 'production'
    ? 'com.ralens.app'
    : process.env.APP_ENV === 'development'
    ? 'com.ralens.dev'
    : process.env.APP_ENV === 'preview'
    ? 'com.ralens.preview'
    : 'com.ralens.local';

const config: ExpoConfig = {
  owner: 'pchmn',
  name,
  slug: 'ralens',
  scheme: 'ralens',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  updates: {
    url: 'https://u.expo.dev/5af2b1a0-4cb6-4afd-974c-22fe1007984d',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: appIdentifier,
    buildNumber: '1.0.0',
    supportsTablet: true,
    googleServicesFile:
      process.env.APP_ENV === 'production'
        ? process.env.GOOGLE_SERVICES_PLIST_PROD
        : process.env.APP_ENV === 'preview'
        ? process.env.GOOGLE_SERVICES_PLIST_PREVIEW
        : process.env.GOOGLE_SERVICES_PLIST_DEV,
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      UIBackgroundModes: ['fetch', 'remote-notification'],
      NSMicrophoneUsageDescription: '$(PRODUCT_NAME) needs access to the microphone in order to record videos',
      NSCameraUsageDescription: '$(PRODUCT_NAME) needs access to the camera in order to take photos and videos',
    },
  },
  android: {
    package: appIdentifier,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    googleServicesFile:
      process.env.APP_ENV === 'production'
        ? process.env.GOOGLE_SERVICES_JSON_PROD
        : process.env.APP_ENV === 'preview'
        ? process.env.GOOGLE_SERVICES_JSON_PREVIEW
        : process.env.GOOGLE_SERVICES_JSON_DEV,
    permissions: ['CAMERA', 'RECORD_AUDIO'],
  },
  locales: {
    en: './locales/en.json',
    fr: './locales/fr.json',
  },
  plugins: [
    '@react-native-firebase/app',
    'sentry-expo',
    'expo-router',
    './plugins/build/withPodFile',
    './plugins/build/withTransparentNavigationBar',
    'react-native-vision-camera',
    'react-native-compressor',
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '13.0',
          useFrameworks: 'static',
        },
        android: {
          extraMavenRepos: ['../../../../node_modules/@notifee/react-native/android/libs'],
          enableProguardInReleaseBuilds: true,
          extraProguardRules: '-keep public class com.horcrux.svg.** {*;} -keep class com.facebook.crypto.** {*;}',
          kotlinVersion: '1.7.0',
        },
      },
    ],
  ],
  hooks: {
    postPublish: [
      {
        file: 'sentry-expo/upload-sourcemaps',
        config: {
          organization: 'pchmn',
          project: process.env.APP_ENV === 'production' ? 'ralens' : 'ralens-dev',
        },
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    eas: {
      projectId: '5af2b1a0-4cb6-4afd-974c-22fe1007984d',
    },
  },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
  },
};

export default config;
