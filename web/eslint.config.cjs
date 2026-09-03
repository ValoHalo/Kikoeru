const { FlatCompat } = require('@eslint/eslintrc')
const js = require('@eslint/js')

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended
})

module.exports = [
  {
    ignores: [
      '.postcssrc.js',
      'dist/**',
      'eslint.config.cjs',
      'src/router/index.js'
    ]
  },
  ...compat.config({
    env: {
      browser: true,
      es2021: true
    },
    extends: [
      'eslint:recommended',
      'plugin:vue/essential'
    ],
    parserOptions: {
      ecmaVersion: 12,
      sourceType: 'module'
    },
    plugins: [
      'vue',
      'import-x'
    ],
    overrides: [
      {
        files: ['scripts/*.js'],
        env: {
          browser: false,
          node: true
        }
      }
    ],
    rules: {
      'import-x/named': 2,
      'import-x/namespace': 2,
      'import-x/default': 2,
      'import-x/export': 2,
      'no-useless-assignment': 'off',
      'no-unused-vars': 'off'
    }
  })
]
