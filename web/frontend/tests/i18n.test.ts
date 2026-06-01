import test from 'node:test'
import assert from 'node:assert/strict'

import { createTranslator } from '../src/i18n/core.ts'

const messages = {
  'zh-CN': {
    layout: {
      home: '首页',
      welcome: '欢迎，{name}'
    }
  },
  en: {
    layout: {
      home: 'Home',
      missingOnlyInEnglish: 'English only'
    }
  }
} as const

test('createTranslator returns localized copy for the active locale', () => {
  const t = createTranslator(messages, 'zh-CN')

  assert.equal(t('layout.home'), '首页')
})

test('createTranslator falls back to English when a locale key is missing', () => {
  const t = createTranslator(messages, 'zh-CN')

  assert.equal(t('layout.missingOnlyInEnglish'), 'English only')
})

test('createTranslator interpolates named params and falls back to the key when missing', () => {
  const t = createTranslator(messages, 'zh-CN')

  assert.equal(t('layout.welcome', { name: '小磁' }), '欢迎，小磁')
  assert.equal(t('layout.unknown'), 'layout.unknown')
})
