const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const prettier = require("eslint-config-prettier");

const nodeGlobals = {
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  global: "readonly",
  require: "readonly",
  module: "readonly",
  exports: "readonly",
};

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      globals: nodeGlobals,
    },
    rules: {
      "semi": ["error", "always"],
      "quotes": ["error", "double", { avoidEscape: true }],
      "indent": ["error", 2],
      "comma-dangle": ["error", "only-multiline"],
      "no-unused-vars": "warn",
      "no-console": "warn",
      "no-debugger": "warn",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      "no-undef": "error",
      "strict": ["error", "safe"],
      "no-eval": "error",
      "prefer-const": "error",
    },
  },
  prettier,
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".turbo/**",
      "coverage/**",
      "*.tsbuildinfo",
      "pnpm-lock.yaml",
    ],
  },
];
