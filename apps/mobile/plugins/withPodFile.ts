import { withDangerousMod, withPlugins } from '@expo/config-plugins';
import { ExpoConfig } from '@expo/config-types';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

function withPodFile(config: ExpoConfig) {
  return withPlugins(config, [
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
          const contents = (await readFile(file, { encoding: 'utf-8' })).replace(
            'post_install do |installer|\n',
            thingsToAdd
          );
          /*
           * Now re-adds the content
           */
          await writeFile(file, contents, { encoding: 'utf-8' });
          return config;
        },
      ]);
    },
  ]);
}

module.exports = withPodFile;
