// plugins/withExcludeFromBackup.js
// Marks Library/Application Support (where AsyncStorage lives) as excluded
// from iCloud / device backup. On reinstall, iOS restores app data from
// backup by default — this prevents that, so locally-stored flags like
// `promoActivated` don't survive an uninstall/reinstall cycle.

const { withAppDelegate } = require("expo/config-plugins");

const SENTINEL = "// exclude-app-support-from-backup";

const SWIFT_SNIPPET = `
    ${SENTINEL}
    if let libraryURL = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first {
      var appSupportURL = libraryURL.appendingPathComponent("Application Support")
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try? appSupportURL.setResourceValues(values)
    }
`;

function patchSwift(contents) {
  if (contents.includes(SENTINEL)) return contents;

  // Inject inside `application(_:didFinishLaunchingWithOptions:)`, right
  // after the opening brace of that function.
  const anchor = /func application\(\s*_ application: UIApplication,\s*didFinishLaunchingWithOptions[\s\S]*?\) -> Bool \{/;
  const match = contents.match(anchor);
  if (!match) {
    throw new Error(
      "[withExcludeFromBackup] Could not find didFinishLaunchingWithOptions in AppDelegate.swift"
    );
  }
  const injectAt = match.index + match[0].length;
  return contents.slice(0, injectAt) + "\n" + SWIFT_SNIPPET + contents.slice(injectAt);
}

module.exports = function withExcludeFromBackup(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift") {
      throw new Error(
        `[withExcludeFromBackup] Expected Swift AppDelegate, got ${cfg.modResults.language}`
      );
    }
    cfg.modResults.contents = patchSwift(cfg.modResults.contents);
    return cfg;
  });
};
