// Adds Pulse's unlockable app icons (assets/app-icons/<file>.png, 1024 x 1024) to the iOS asset
// catalog as alternate app icons, so modules/pulse-app-icon can switch to them at runtime.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');

// Asset catalog name -> source file. Keep in sync with APP_ICONS in src/lib/app-icons.ts.
const ICONS = {
  'AppIcon-Synthwave': 'synthwave',
  'AppIcon-NeonSign': 'neon-sign',
  'AppIcon-MidnightRain': 'midnight-rain',
  'AppIcon-Arcade': 'arcade',
  'AppIcon-GoldLegend': 'gold-legend',
};

const contents = {
  images: [{ filename: 'icon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
  info: { author: 'xcode', version: 1 },
};

module.exports = function withAlternateIcons(config) {
  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      const catalog = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName, 'Images.xcassets');
      for (const [name, file] of Object.entries(ICONS)) {
        const dir = path.join(catalog, `${name}.appiconset`);
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(path.join(c.modRequest.projectRoot, 'assets', 'app-icons', `${file}.png`), path.join(dir, 'icon.png'));
        fs.writeFileSync(path.join(dir, 'Contents.json'), JSON.stringify(contents, null, 2));
      }
      return c;
    },
  ]);
  return withXcodeProject(config, (c) => {
    // Only the app target names an app icon, so this skips the widget extension.
    const configs = c.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configs)) {
      const settings = entry && entry.buildSettings;
      if (!settings || settings.ASSETCATALOG_COMPILER_APPICON_NAME !== 'AppIcon') continue;
      settings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = `"${Object.keys(ICONS).join(' ')}"`;
      settings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = 'YES';
    }
    return c;
  });
};
