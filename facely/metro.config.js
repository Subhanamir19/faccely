const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const { assetExts, sourceExts } = config.resolver;

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};

config.resolver.assetExts = assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts = [...new Set([...sourceExts, "svg"])];
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, "lottie"])];

// Release builds must not carry the dev-only Lottie previews: those
// `.embedded.json` sources inline their images, adding ~11 MB to the JS
// bundle for a screen that is unreachable in production (`href: null`).
// Swapping the module at resolve time keeps the dev screen fully working in
// development while the payload disappears from release bundles.
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEV_LOTTIE_STUB = path.resolve(__dirname, "lib/devLottiePreviews.prod.ts");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (IS_PRODUCTION && moduleName.endsWith("devLottiePreviews")) {
    return { type: "sourceFile", filePath: DEV_LOTTIE_STUB };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
