import js from '@eslint/js';

export default [
  {
    ignores: ['coverage/**', 'dist/**', 'node_modules/**', 'release/**', 'site-dist/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        URL: 'readonly',
        console: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly'
      }
    },
    rules: {
      'no-console': ['error', { allow: ['error', 'log', 'warn'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['docs-site/**/*.js'],
    languageOptions: {
      globals: {
        StacklineToolRouter: 'readonly'
      }
    }
  }
];
