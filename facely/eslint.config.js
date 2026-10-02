// Flat ESLint config (ESLint 9).
// The point of this file is the `reanimated/*` block: `tsc` cannot see worklet
// violations, so a screen can typecheck clean and still take the app down on
// the UI thread. Those rules are errors; style-level noise is left as warnings
// so `--max-warnings` stays usable as a gate later.
const expoConfig = require("eslint-config-expo/flat");
const local = require("./eslint-rules");

module.exports = [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".expo/**",
      "android/**",
      "ios/**",
      "patches/**",
      "design-demos/**",
      "*.config.js",
      "print-babel-config.cjs",
    ],
  },
  ...expoConfig,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { local },
    rules: {
      // Calling a plain JS function inside useAnimatedStyle / useAnimatedProps /
      // useDerivedValue runs it on the UI thread. This is the class of crash
      // that typechecking lets straight through.
      "local/no-js-function-in-worklet": "error",

      // Stale closures in animation effects cause animations that silently
      // never re-run, which reads as "the screen is broken" rather than a crash.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // The React Compiler-era rules that ship with eslint-config-expo flag
      // ~220 pre-existing sites across this codebase. They are worth reading,
      // but as errors they drown the two rules above and make `lint:gate`
      // useless on day one. Demoted to warnings so the error channel stays
      // reserved for "this will break at runtime".
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react/no-unescaped-entities": "warn",
      "react/display-name": "warn",
    },
  },
];
