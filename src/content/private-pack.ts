/**
 * Loads the household's private content file if this machine has one. The file is
 * `content/private/household.json`: git ignores it, and EAS cloud builds skip ignored files, so a
 * public build can never contain it. Only a local build (`npx expo run:ios`) bundles it, onto your own phone.
 *
 * Metro treats a `require` inside try/catch as optional, so a missing file is fine and returns null.
 * The value is untrusted; `applyPrivateContent` validates it. See docs/PRIVATE_CONTENT.md.
 */
export function loadPrivatePack(): unknown {
  try {
    return require('../../content/private/household.json');
  } catch {
    return null;
  }
}
