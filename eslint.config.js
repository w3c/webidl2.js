import js from "@eslint/js";
import globals from "globals";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  importPlugin.flatConfigs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.mocha,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "eol-last": "error",
      "import/extensions": ["error", "always"],
      "import/no-unresolved": 0, // https://github.com/import-js/eslint-plugin-import/issues/3082
      "no-console": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-trailing-spaces": "error",
      "prefer-const": "error",
      semi: "error",
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map(config => {
    return {
      files: ["lib/**"],
      ...config
    }
  })
];
