// Local ESLint rules.
//
// `eslint-plugin-reanimated` is not usable here: its js-function-in-worklet rule
// bails out unless `parserServices.hasFullTypeInformation` is set, a flag that
// typescript-eslint removed years ago, so the rule silently reports nothing.
// This is a scope-based reimplementation that needs no type information.
const WORKLET_HOOKS = new Set([
  "useAnimatedStyle",
  "useAnimatedProps",
  "useDerivedValue",
  "useAnimatedReaction",
  "useAnimatedScrollHandler",
  "useAnimatedGestureHandler",
  "useFrameCallback",
]);

// Globals the UI runtime provides, plus Reanimated's own worklet-safe helpers.
const SAFE_CALLEES = new Set([
  "Math", "Number", "String", "Boolean", "Array", "Object", "JSON", "Date",
  "parseInt", "parseFloat", "isNaN", "isFinite",
  "interpolate", "interpolateColor", "interpolateNode", "clamp",
  "withTiming", "withSpring", "withDecay", "withDelay", "withSequence",
  "withRepeat", "cancelAnimation", "runOnJS", "runOnUI", "scheduleOnRN",
  "scheduleOnUI", "makeMutable", "measure", "scrollTo", "dispatchCommand",
  "setGestureState", "setNativeProps", "convertToRGBA", "processColor",
]);

const SAFE_MODULES = new Set([
  "react-native-reanimated",
  "react-native-worklets",
  "react-native-worklets-core",
  "react-native-gesture-handler",
]);

function hasWorkletDirective(node) {
  const body = node && node.body;
  if (!body || body.type !== "BlockStatement") return false;
  return body.body.some(
    (stmt) =>
      stmt.type === "ExpressionStatement" &&
      stmt.expression.type === "Literal" &&
      stmt.expression.value === "worklet",
  );
}

/** Walk up from a node to the nearest enclosing worklet function, if any. */
function enclosingWorklet(node) {
  let current = node;
  while (current) {
    const isFn =
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionExpression" ||
      current.type === "FunctionDeclaration";

    if (isFn) {
      if (hasWorkletDirective(current)) return current;
      const parent = current.parent;
      if (
        parent &&
        parent.type === "CallExpression" &&
        parent.callee.type === "Identifier" &&
        WORKLET_HOOKS.has(parent.callee.name) &&
        parent.arguments.includes(current)
      ) {
        return current;
      }
      // A non-worklet function boundary: anything inside it runs on JS.
      if (current.type === "FunctionDeclaration") return null;
    }
    current = current.parent;
  }
  return null;
}

/** Resolve an identifier to its declaring variable through the scope chain. */
function resolveVariable(scope, name) {
  let current = scope;
  while (current) {
    const found = current.variables.find((v) => v.name === name);
    if (found) return found;
    current = current.upper;
  }
  return null;
}

const noJsFunctionInWorklet = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow calling non-worklet functions inside worklets. They are invoked on the UI thread and take the app down.",
    },
    schema: [],
    messages: {
      jsFunctionInWorklet:
        "'{{name}}' is not a worklet, so calling it inside {{hook}} runs a plain JS function on the UI thread. Compute the value on the JS thread and capture it, mark '{{name}}' with the 'worklet' directive, or call it through runOnJS.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;

        const name = node.callee.name;
        if (SAFE_CALLEES.has(name) || WORKLET_HOOKS.has(name)) return;

        const worklet = enclosingWorklet(node);
        if (!worklet) return;

        const scope = sourceCode.getScope
          ? sourceCode.getScope(node)
          : context.getScope();
        const variable = resolveVariable(scope, name);

        // Unresolved means a global we do not know; do not guess.
        if (!variable || variable.defs.length === 0) return;

        const def = variable.defs[0];

        // Imported from a library that ships worklets.
        if (def.type === "ImportBinding") {
          const source = def.parent && def.parent.source && def.parent.source.value;
          if (SAFE_MODULES.has(source)) return;
        }

        // Declared inside this worklet, so it is workletized along with it.
        if (
          def.node &&
          def.node.range &&
          def.node.range[0] >= worklet.range[0] &&
          def.node.range[1] <= worklet.range[1]
        ) {
          return;
        }

        // Explicitly marked as a worklet at its definition.
        const fnNode =
          def.node && def.node.type === "VariableDeclarator" ? def.node.init : def.node;
        if (hasWorkletDirective(fnNode)) return;

        const hookName =
          worklet.parent &&
          worklet.parent.type === "CallExpression" &&
          worklet.parent.callee.type === "Identifier"
            ? worklet.parent.callee.name
            : "a worklet";

        context.report({
          node: node.callee,
          messageId: "jsFunctionInWorklet",
          data: { name, hook: hookName },
        });
      },
    };
  },
};

module.exports = {
  rules: {
    "no-js-function-in-worklet": noJsFunctionInWorklet,
  },
};
