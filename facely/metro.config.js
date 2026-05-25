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

module.exports = config;
