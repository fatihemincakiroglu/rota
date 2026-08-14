import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // JSX'te kullanilan tanimlayicilar (React, App, SearchBox...) no-unused-vars
      // tarafindan "kullanilmiyor" sanilmasin
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      // Bu kural mount aninda dis kaynaktan (URL, localStorage, harita) durum
      // yuklemeyi de isaretliyor. Buradaki kullanimlar kasitli ve tek seferlik;
      // kurali acik birakmak surekli bastirma yorumu yazmayi gerektirirdi.
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Kullanilmayan degisken = hata. Bu turda elle bulunan olu kodun
      // (shortLabel, anyArc, atanip birakilan tag) hepsi buraya takilirdi.
      // Bilerek kullanilmayanlar bas harfi buyuk _ ile isaretlenebilir.
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  {
    // Vite yapilandirmasi Node ortaminda calisir (__dirname, process)
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
