import test from 'node:test'
import assert from 'node:assert/strict'

import { onboardingGuideSteps } from '../src/onboarding/guideSteps.ts'

test('onboarding guide follows the first-run writing workflow', () => {
  assert.deepEqual(
    onboardingGuideSteps.map((step) => step.id),
    [
      'ai-models',
      'work-context',
      'novel-seed',
      'planning',
      'auto-generation',
      'editor',
      'validation'
    ]
  )
})

test('onboarding guide steps have navigable routes and click targets', () => {
  for (const step of onboardingGuideSteps) {
    assert.match(step.route, /^\//)
    assert.match(step.target, /^\[data-guide="/)
    assert.ok(step.title.length > 0)
    assert.ok(step.description.length > 0)
  }
})
