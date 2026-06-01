import eslintReact from "@eslint-react/eslint-plugin";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { importX } from "eslint-plugin-import-x";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const browserNodeGlobals = {
  ...globals.browser,
  ...globals.es2022,
  ...globals.node,
  NodeJS: "readonly",
};

export default defineConfig(
  {
    ignores: ["node_modules", "build", "dist", "src/types/generated/**"],
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    extends: [js.configs.recommended, importX.flatConfigs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: browserNodeGlobals,
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
      eslintReact.configs["recommended-type-checked"],
      eslintReact.configs["disable-conflict-eslint-plugin-react-hooks"],
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: browserNodeGlobals,
    },
    rules: {
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/purity": "off",
      "@eslint-react/set-state-in-effect": "off",
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  eslintPluginPrettierRecommended,
);
