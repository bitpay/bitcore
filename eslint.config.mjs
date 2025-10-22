import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  js.configs.recommended,
  {
    ignores: ['**/node_modules/**', '**/build/**', '**/ts_build/**', 'packages/insight/**']
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js, import: importPlugin },
    extends: ['js/recommended'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        'NodeJS': 'readonly',
        'BufferEncoding': 'readonly',
      }
    }
  },
  tseslint.configs.recommended,
  { // TypeScript files
    files: ['**/*.{ts,mts,cts}'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      '@stylistic': stylistic,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-duplicate-enum-values': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    }
  },
  {
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {

      quotes: ['error', 'single', { avoidEscape: true }],
      'prefer-const': 'warn',
      'no-var': 'warn',
      'no-undef': 'error',
      'no-async-promise-executor': 'off',
      'semi': ['error', 'always'],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'no-case-declarations': 'off',
      'no-bitwise': 'error',
      'spaced-comment': ['error', 'always', { exceptions: ['-', '+'] }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'comma-spacing': ['error', { before: false, after: true }],
      'space-before-blocks': ['error', 'always'],
      'keyword-spacing': ['error', { before: true, after: true }],
      'no-multi-spaces': ['error', { ignoreEOLComments: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.type="MemberExpression"][callee.property.name="forEach"]',
          message: 'Use for...of loop or array methods like map/filter instead of forEach'
        }
      ],
      'sort-imports': ['error', {
        ignoreDeclarationSort: true, // rule cannot be auto-fixed
        ignoreMemberSort: false // import { b, a } from 'X' -> import { a, b } from 'X'
      }],
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'never',
        alphabetize: { order: 'asc', caseInsensitive: false }
      }],
      'import/newline-after-import': 'error'
    }
  },
  {
    files: [
      'packages/bitcore-lib*/**/*.js',
      'packages/bitcore-p2p*/**/*.js'
    ],
    languageOptions: { sourceType: 'commonjs' },
    rules: {
      // 'no-var': 'warn'
    }
  },
  // Test files -- needs to be last so it can override other settings
  {
    files: ['**/test/**/*.{ts,js}'],
    languageOptions: {
      globals: {
        ...globals.mocha
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'sort-imports': 'off',
      'import/order': 'off'
    }
  }
]);
