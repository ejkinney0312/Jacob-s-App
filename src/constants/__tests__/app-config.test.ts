import type { ConfigContext } from 'expo/config';
import type { ExportedConfig } from 'expo/config-plugins';

// app.config.ts reads QUEST_BLOCKS_RELEASE when it loads, so load it fresh for each case.
function loadConfig(release: boolean, base: ConfigContext['config']): ExportedConfig {
  const original = process.env.QUEST_BLOCKS_RELEASE;
  if (release) process.env.QUEST_BLOCKS_RELEASE = '1';
  else delete process.env.QUEST_BLOCKS_RELEASE;
  try {
    let result: ExportedConfig | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const build = require('../../../app.config').default as (ctx: ConfigContext) => ExportedConfig;
      result = build({ projectRoot: '.', staticConfigPath: null, packageJsonPath: null, config: base });
    });
    if (!result) throw new Error('app.config did not return a config');
    return result;
  } finally {
    if (original === undefined) delete process.env.QUEST_BLOCKS_RELEASE;
    else process.env.QUEST_BLOCKS_RELEASE = original;
  }
}

const base = {
  name: 'Mend',
  slug: 'quest-blocks',
  android: { blockedPermissions: ['android.permission.READ_EXTERNAL_STORAGE'] },
};

describe('app.config.ts', () => {
  it('leaves development builds alone (the dev server needs INTERNET and the overlay)', () => {
    const config = loadConfig(false, base);
    expect(config.android?.blockedPermissions).toEqual(['android.permission.READ_EXTERNAL_STORAGE']);
  });

  it('blocks the dev-only Android permissions in a release build and keeps the existing ones', () => {
    const blocked = loadConfig(true, base).android?.blockedPermissions ?? [];
    expect(blocked).toEqual(
      expect.arrayContaining([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.INTERNET',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ]),
    );
  });

  it('adds an iOS mod in release that strips the dev launcher local-network entries', () => {
    expect(loadConfig(true, base).mods?.ios?.infoPlist).toBeDefined();
    expect(loadConfig(false, base).mods?.ios?.infoPlist).toBeUndefined();
  });

  it('refuses to build without a name and slug instead of guessing', () => {
    expect(() => loadConfig(false, {})).toThrow('name');
  });
});
