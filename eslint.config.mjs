import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


export default [
  {
    files: [
      "**/*.ts"
    ]
  },
  {
    ignores: [
      "node_modules/*",
      "out/*",
      "aws/*",
      "tools/*"
    ],
  },
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];