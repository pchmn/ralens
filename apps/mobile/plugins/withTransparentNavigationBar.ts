import { AndroidConfig, withAndroidStyles } from '@expo/config-plugins';
import { writeXMLAsync } from '@expo/config-plugins/build/utils/XML';
import { ExpoConfig } from '@expo/config-types';

function withTransparentNavigationBar(config: ExpoConfig) {
  return withAndroidStyles(config, async (config) => {
    config.modResults = await applyAndroidStyles(config.modResults);
    return config;
  });
}

async function applyAndroidStyles(styles: AndroidConfig.Resources.ResourceXML) {
  const appTheme = styles.resources.style?.find((style) => style.$.name === 'AppTheme');
  if (appTheme) {
    const navigationBarColor = appTheme.item.find((item) => item.$.name === 'android:navigationBarColor');
    if (navigationBarColor) {
      navigationBarColor._ = '@android:color/transparent';
    } else {
      appTheme.item.push(
        AndroidConfig.Resources.buildResourceItem({
          name: 'android:navigationBarColor',
          value: '@android:color/transparent',
        })
      );
    }
    const statusBarColor = appTheme.item.find((item) => item.$.name === 'android:statusBarColor');
    if (statusBarColor) {
      statusBarColor._ = '@android:color/transparent';
    } else {
      appTheme.item.push(
        AndroidConfig.Resources.buildResourceItem({
          name: 'android:statusBarColor',
          value: '@android:color/transparent',
        })
      );
    }
  }

  const stylesV29 = JSON.parse(JSON.stringify(styles)) as AndroidConfig.Resources.ResourceXML;
  const appThemeV29 = stylesV29.resources.style?.find((style) => style.$.name === 'AppTheme');
  if (appThemeV29) {
    appThemeV29.item.push(
      AndroidConfig.Resources.buildResourceItem({
        name: 'android:enforceNavigationBarContrast',
        value: 'false',
      })
    );
    await writeXMLAsync({ path: 'android/app/src/main/res/values-v29/styles.xml', xml: stylesV29 });
  }

  return styles;
}

module.exports = withTransparentNavigationBar;
