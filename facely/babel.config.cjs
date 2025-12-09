// babel.config.js
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: {
            "@": "./",
            "@components": "./components",
            "@lib": "./lib",
            "@store": "./store",
            "@stores": "./store",
          },
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      ],

      // MUST stay last or Reanimated will break in production
      "react-native-reanimated/plugin",
    ],
  };
};
