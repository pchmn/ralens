"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("@expo/config-plugins");
const XML_1 = require("@expo/config-plugins/build/utils/XML");
function withTransparentNavigationBar(config) {
    return (0, config_plugins_1.withAndroidStyles)(config, async (config) => {
        config.modResults = await applyAndroidStyles(config.modResults);
        return config;
    });
}
async function applyAndroidStyles(styles) {
    const appTheme = styles.resources.style?.find((style) => style.$.name === 'AppTheme');
    if (appTheme) {
        const navigationBarColor = appTheme.item.find((item) => item.$.name === 'android:navigationBarColor');
        if (navigationBarColor) {
            navigationBarColor._ = '@android:color/transparent';
        }
        else {
            appTheme.item.push(config_plugins_1.AndroidConfig.Resources.buildResourceItem({
                name: 'android:navigationBarColor',
                value: '@android:color/transparent',
            }));
        }
        const statusBarColor = appTheme.item.find((item) => item.$.name === 'android:statusBarColor');
        if (statusBarColor) {
            statusBarColor._ = '@android:color/transparent';
        }
        else {
            appTheme.item.push(config_plugins_1.AndroidConfig.Resources.buildResourceItem({
                name: 'android:statusBarColor',
                value: '@android:color/transparent',
            }));
        }
    }
    const stylesV29 = JSON.parse(JSON.stringify(styles));
    const appThemeV29 = stylesV29.resources.style?.find((style) => style.$.name === 'AppTheme');
    if (appThemeV29) {
        appThemeV29.item.push(config_plugins_1.AndroidConfig.Resources.buildResourceItem({
            name: 'android:enforceNavigationBarContrast',
            value: 'false',
        }));
        await (0, XML_1.writeXMLAsync)({ path: 'android/app/src/main/res/values-v29/styles.xml', xml: stylesV29 });
    }
    return styles;
}
module.exports = withTransparentNavigationBar;
