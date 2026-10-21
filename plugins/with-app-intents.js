// Adds PulseAppIntents.swift (Siri / Shortcuts / Action Button) to the iOS app target. App Intents
// have to be compiled into the app itself for iOS to find them, so they can't live in a pod.
const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const FILE = 'PulseAppIntents.swift';

module.exports = function withAppIntents(config) {
  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName);
      fs.copyFileSync(path.join(__dirname, 'app-intents', FILE), path.join(dir, FILE));
      return c;
    },
  ]);
  return withXcodeProject(config, (c) => {
    const name = c.modRequest.projectName;
    const filepath = `${name}/${FILE}`;
    if (!c.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: name, project: c.modResults });
    }
    return c;
  });
};
