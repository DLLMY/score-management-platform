/**
 * 前端 ESLint 配置（T10 #960：清理 CRA eslint 残留）
 *
 * 原 `.eslintrc.json` 仅 `extends: ["react-app"]`，依赖 `eslint-config-react-app`
 * （CRA 专属分享配置 + 291 行 opinionated 规则）。本文件将其规则集**原样内联**，
 * 移除 CRA 依赖，保持与历史 `eslint src` 结果零漂移（0 errors，仅 no-console warning）。
 *
 * 与 react-app 的差异（均为去重/精简，不影响已 lint 文件的结果）：
 *  - 全局改用 `@typescript-eslint/parser`（原非 TS 文件用 @babel/eslint-parser），
 *    因本仓仅 .ts/.tsx 参与 lint（见 package.json `lint` 脚本 --ext .ts,.tsx），
 *    解析结果一致，且省去 @babel/eslint-parser + babel-preset-react-app + @rushstack/eslint-patch。
 *  - 移除 `eslint-plugin-flowtype` 及其 3 条规则：本仓无 Flow 文件，零影响。
 *  - `no-restricted-globals` 仍通过 require('confusing-browser-globals')  faithfully 复刻。
 *  - 末尾附项目原叠加规则（no-console / react/no-unknown-property / prop-types / jsx-scope / testing-library），
 *    与原 `.eslintrc.json` 完全一致。
 */
'use strict';

const restrictedGlobals = require('confusing-browser-globals');

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    warnOnUnsupportedTypeScriptVersion: true,
  },
  env: {
    browser: true,
    node: true,
    es2020: true,
    jest: true,
  },
  plugins: ['react', 'react-hooks', 'jsx-a11y', 'import', '@typescript-eslint'],
  settings: {
    react: { version: 'detect' },
  },
  overrides: [
    {
      files: ['**/*.ts?(x)'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        warnOnUnsupportedTypeScriptVersion: true,
      },
      plugins: ['@typescript-eslint'],
      rules: {
        // TypeScript 下禁用 ESLint 原生等价规则，改用 @typescript-eslint 版本（tsc 已覆盖类型检查）
        'default-case': 'off',
        'no-dupe-class-members': 'off',
        'no-undef': 'off',
        'no-array-constructor': 'off',
        'no-redeclare': 'off',
        'no-use-before-define': 'off',
        'no-unused-expressions': 'off',
        'no-unused-vars': 'off',
        'no-useless-constructor': 'off',
        '@typescript-eslint/consistent-type-assertions': 'warn',
        '@typescript-eslint/no-array-constructor': 'warn',
        '@typescript-eslint/no-redeclare': 'warn',
        '@typescript-eslint/no-use-before-define': [
          'warn',
          { functions: false, classes: false, variables: false, typedefs: false },
        ],
        '@typescript-eslint/no-unused-expressions': [
          'error',
          { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
        ],
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { args: 'none', ignoreRestSiblings: true },
        ],
        '@typescript-eslint/no-useless-constructor': 'warn',
      },
    },
  ],
  rules: {
    // --- 源自 react-app base.js 的 react 基础规则 ---
    'react/jsx-uses-vars': 'warn',
    'react/jsx-uses-react': 'warn',

    // --- react-app index.js 主规则集（几乎全 warn，与 CRA 一致）---
    'array-callback-return': 'warn',
    'default-case': ['warn', { commentPattern: '^no default$' }],
    'dot-location': ['warn', 'property'],
    eqeqeq: ['warn', 'smart'],
    'new-parens': 'warn',
    'no-array-constructor': 'warn',
    'no-caller': 'warn',
    'no-cond-assign': ['warn', 'except-parens'],
    'no-const-assign': 'warn',
    'no-control-regex': 'warn',
    'no-delete-var': 'warn',
    'no-dupe-args': 'warn',
    'no-dupe-class-members': 'warn',
    'no-dupe-keys': 'warn',
    'no-duplicate-case': 'warn',
    'no-empty-character-class': 'warn',
    'no-empty-pattern': 'warn',
    'no-eval': 'warn',
    'no-ex-assign': 'warn',
    'no-extend-native': 'warn',
    'no-extra-bind': 'warn',
    'no-extra-label': 'warn',
    'no-fallthrough': 'warn',
    'no-func-assign': 'warn',
    'no-implied-eval': 'warn',
    'no-invalid-regexp': 'warn',
    'no-iterator': 'warn',
    'no-label-var': 'warn',
    'no-labels': ['warn', { allowLoop: true, allowSwitch: false }],
    'no-lone-blocks': 'warn',
    'no-loop-func': 'warn',
    'no-mixed-operators': [
      'warn',
      {
        groups: [
          ['&', '|', '^', '~', '<<', '>>', '>>>'],
          ['==', '!=', '===', '!==', '>', '>=', '<', '<='],
          ['&&', '||'],
          ['in', 'instanceof'],
        ],
        allowSamePrecedence: false,
      },
    ],
    'no-multi-str': 'warn',
    'no-global-assign': 'warn',
    'no-unsafe-negation': 'warn',
    'no-new-func': 'warn',
    'no-new-object': 'warn',
    'no-new-symbol': 'warn',
    'no-new-wrappers': 'warn',
    'no-obj-calls': 'warn',
    'no-octal': 'warn',
    'no-octal-escape': 'warn',
    'no-redeclare': 'warn',
    'no-regex-spaces': 'warn',
    'no-restricted-syntax': ['warn', 'WithStatement'],
    'no-script-url': 'warn',
    'no-self-assign': 'warn',
    'no-self-compare': 'warn',
    'no-sequences': 'warn',
    'no-shadow-restricted-names': 'warn',
    'no-sparse-arrays': 'warn',
    'no-template-curly-in-string': 'warn',
    'no-this-before-super': 'warn',
    'no-throw-literal': 'warn',
    'no-undef': 'error',
    'no-restricted-globals': ['error'].concat(restrictedGlobals),
    'no-unreachable': 'warn',
    'no-unused-expressions': [
      'error',
      { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
    ],
    'no-unused-labels': 'warn',
    'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
    'no-use-before-define': ['warn', { functions: false, classes: false, variables: false }],
    'no-useless-computed-key': 'warn',
    'no-useless-concat': 'warn',
    'no-useless-constructor': 'warn',
    'no-useless-escape': 'warn',
    'no-useless-rename': [
      'warn',
      { ignoreDestructuring: false, ignoreImport: false, ignoreExport: false },
    ],
    'no-whitespace-before-property': 'warn',
    'no-with': 'warn',
    'getter-return': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'require-yield': 'warn',
    'rest-spread-spacing': ['warn', 'never'],
    strict: ['warn', 'never'],
    'unicode-bom': ['warn', 'never'],
    'use-isnan': 'warn',
    'valid-typeof': 'warn',
    'no-restricted-properties': [
      'error',
      {
        object: 'require',
        property: 'ensure',
        message:
          'Please use import() instead. More info: https://facebook.github.io/create-react-app/docs/code-splitting',
      },
      {
        object: 'System',
        property: 'import',
        message:
          'Please use import() instead. More info: https://facebook.github.io/create-react-app/docs/code-splitting',
      },
    ],

    // import
    'import/first': 'error',
    'import/no-amd': 'error',
    'import/no-anonymous-default-export': 'warn',
    'import/no-webpack-loader-syntax': 'error',

    // react
    'react/forbid-foreign-prop-types': ['warn', { allowInPropTypes: true }],
    'react/jsx-no-comment-textnodes': 'warn',
    'react/jsx-no-duplicate-props': 'warn',
    'react/jsx-no-target-blank': 'warn',
    'react/jsx-no-undef': 'error',
    'react/jsx-pascal-case': ['warn', { allowAllCaps: true, ignore: [] }],
    'react/no-danger-with-children': 'warn',
    'react/no-direct-mutation-state': 'warn',
    'react/no-is-mounted': 'warn',
    'react/no-typos': 'error',
    'react/require-render-return': 'error',
    'react/style-prop-object': 'warn',

    // jsx-a11y
    'jsx-a11y/alt-text': 'warn',
    'jsx-a11y/anchor-has-content': 'warn',
    'jsx-a11y/anchor-is-valid': ['warn', { aspects: ['noHref', 'invalidHref'] }],
    'jsx-a11y/aria-activedescendant-has-tabindex': 'warn',
    'jsx-a11y/aria-props': 'warn',
    'jsx-a11y/aria-proptypes': 'warn',
    'jsx-a11y/aria-role': ['warn', { ignoreNonDOM: true }],
    'jsx-a11y/aria-unsupported-elements': 'warn',
    'jsx-a11y/heading-has-content': 'warn',
    'jsx-a11y/iframe-has-title': 'warn',
    'jsx-a11y/img-redundant-alt': 'warn',
    'jsx-a11y/no-access-key': 'warn',
    'jsx-a11y/no-distracting-elements': 'warn',
    'jsx-a11y/no-redundant-roles': 'warn',
    'jsx-a11y/role-has-required-aria-props': 'warn',
    'jsx-a11y/role-supports-aria-props': 'warn',
    'jsx-a11y/scope': 'warn',

    // react-hooks
    'react-hooks/rules-of-hooks': 'error',

    // --- 项目原 .eslintrc.json 叠加规则（与历史完全一致）---
    'react/no-unknown-property': 'error',
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-console': 'warn',
    'testing-library/no-container': 'off',
    'testing-library/no-node-access': 'off',
  },
};
