"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("@expo/config-plugins");
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
function withPodFile(config) {
    return (0, config_plugins_1.withPlugins)(config, [
        (config) => {
            return (0, config_plugins_1.withDangerousMod)(config, [
                'ios',
                async (config) => {
                    const file = path_1.default.join(config.modRequest.platformProjectRoot, 'Podfile');
                    const thingsToAdd = '  post_install do |installer|\n' +
                        '  installer.pods_project.targets.each do |target|\n' +
                        '    target.build_configurations.each do |config|\n' +
                        "      config.build_settings['HEADER_SEARCH_PATHS'] ||= '$(inherited) '\n" +
                        "      config.build_settings['HEADER_SEARCH_PATHS'] << '\"${PODS_ROOT}/../../../../node_modules/react-native/ReactCommon\" '\n" +
                        '    end\n' +
                        '  end\n';
                    // replaces the line post_install do |installer| with the content of thingsToAdd
                    const contents = (await (0, promises_1.readFile)(file, { encoding: 'utf-8' })).replace('post_install do |installer|\n', thingsToAdd);
                    /*
                     * Now re-adds the content
                     */
                    await (0, promises_1.writeFile)(file, contents, { encoding: 'utf-8' });
                    return config;
                },
            ]);
        },
    ]);
}
module.exports = withPodFile;
