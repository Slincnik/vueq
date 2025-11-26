import globals from 'globals';
import pluginsJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

//
export default defineConfig([
  {
    ignores: ['dist/*', 'node_modules/*'],
  },

  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },

  pluginsJs.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },

  eslintConfigPrettier,
]);
