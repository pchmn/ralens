/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const { withDangerousMod, withPlugins } = require('@expo/config-plugins');

async function readFile(path) {
  return fs.promises.readFile(path, 'utf8');
}

async function saveFile(path, content) {
  return fs.promises.writeFile(path, content, 'utf8');
}

module.exports = (config) =>
  withPlugins(config, [
    (config) => {
      return withDangerousMod(config, [
        'ios',
        async (config) => {
          const file = path.join(config.modRequest.platformProjectRoot, 'Podfile');
          const thingsToAdd =
            '  post_install do |installer|\n' +
            '  installer.pods_project.targets.each do |target|\n' +
            '    target.build_configurations.each do |config|\n' +
            "      config.build_settings['HEADER_SEARCH_PATHS'] ||= '$(inherited) '\n" +
            "      config.build_settings['HEADER_SEARCH_PATHS'] << '\"${PODS_ROOT}/../../../../node_modules/react-native/ReactCommon\" '\n" +
            '    end\n' +
            '  end\n';

          // replaces the line post_install do |installer| with the content of thingsToAdd
          const contents = (await readFile(file)).replace('post_install do |installer|\n', thingsToAdd);
          /*
           * Now re-adds the content
           */
          await saveFile(file, contents);
          return config;
        },
      ]);
    },
  ]);
