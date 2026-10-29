import type { ConfigContext, ExpoConfig } from 'expo/config';
import { type ConfigPlugin, withInfoPlist } from 'expo/config-plugins';

/**
 * app.json holds the settings shared by every build. This file only adds the release-only
 * hardening, switched on with QUEST_BLOCKS_RELEASE=1 (set by the `production` profile in eas.json).
 * Development builds keep the permissions the dev server and dev launcher need.
 */
const RELEASE = process.env.QUEST_BLOCKS_RELEASE === '1';

// The app has no network features (P0 is offline), and the overlay permission is only for the dev menu.
const ANDROID_DEV_ONLY_PERMISSIONS = ['android.permission.INTERNET', 'android.permission.SYSTEM_ALERT_WINDOW'];

// The dev launcher asks iOS for local-network access to find Metro on your computer.
const IOS_DEV_ONLY_INFO_PLIST_KEYS = ['NSBonjourServices', 'NSLocalNetworkUsageDescription'];

const withoutDevLocalNetwork: ConfigPlugin = (config) =>
  withInfoPlist(config, (modConfig) => {
    for (const key of IOS_DEV_ONLY_INFO_PLIST_KEYS) {
      delete modConfig.modResults[key];
    }
    return modConfig;
  });

export default ({ config }: ConfigContext): ExpoConfig => {
  const { name, slug } = config;
  if (!name || !slug) {
    throw new Error('app.json must define "name" and "slug".');
  }
  const base: ExpoConfig = { ...config, name, slug };
  if (!RELEASE) {
    return base;
  }

  return withoutDevLocalNetwork({
    ...base,
    android: {
      ...base.android,
      blockedPermissions: [...(base.android?.blockedPermissions ?? []), ...ANDROID_DEV_ONLY_PERMISSIONS],
    },
  });
};
