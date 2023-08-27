import 'dotenv/config';

import { ExpoConfig } from '@expo/config';

const name =
  process.env.APP_ENV === 'production'
    ? 'Prevezic'
    : process.env.APP_ENV === 'development'
    ? 'PrevezicDev'
    : process.env.APP_ENV === 'preview'
    ? 'PrevezicPreview'
    : 'PrevezicLocal';

const appIdentifier =
  process.env.APP_ENV === 'production'
    ? 'com.prevezic.app'
    : process.env.APP_ENV === 'development'
    ? 'com.prevezic.dev'
    : process.env.APP_ENV === 'preview'
    ? 'com.prevezic.preview'
    : 'com.prevezic.local';

const config: ExpoConfig = {
  owner: 'pchmn',
  name,
  slug: 'prevezic',
  scheme: 'prevezic',
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
    url: 'https://u.expo.dev/7ebb51eb-8225-4b52-a8be-1a4174bfe8ad',
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
      UIBackgroundModes: ['fetch', 'remote-notification'],
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
  },
  plugins: [
    '@react-native-firebase/app',
    'sentry-expo',
    'expo-router',
    './plugins/withPodfile',
    'react-native-vision-camera',
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
    [
      'react-native-vision-camera',
      {
        cameraPermissionText: '$(PRODUCT_NAME) needs access to your Camera.',

        // optionally, if you want to record audio:
        enableMicrophonePermission: true,
        microphonePermissionText: '$(PRODUCT_NAME) needs access to your Microphone.',
      },
    ],
  ],
  hooks: {
    postPublish: [
      {
        file: 'sentry-expo/upload-sourcemaps',
        config: {
          organization: 'pchmn',
          project: process.env.APP_ENV === 'production' ? 'prevezic' : 'prevezic-dev',
        },
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    eas: {
      projectId: '7ebb51eb-8225-4b52-a8be-1a4174bfe8ad',
    },
  },
  experiments: {
    tsconfigPaths: true,
  },
};

export default config;
