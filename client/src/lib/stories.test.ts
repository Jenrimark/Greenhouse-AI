import test from 'node:test'
import assert from 'node:assert/strict'
import { unwrapStories, storyPayload } from './stories.ts'

test('unwrapStories reads stories from the API data envelope', () => {
  assert.deepEqual(unwrapStories({ data: { items: [{ id: '1', title: '项目' }] } }), [{ id: '1', title: '项目' }])
})

test('storyPayload trims fields and splits bullet lines', () => {
  assert.deepEqual(storyPayload('  项目  ', '  公司 ', '成果\n\n  指标  '), {
    title: '项目', org: '公司', bullets: ['成果', '  指标  '],
  })
})
