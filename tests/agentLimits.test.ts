import { describe, expect, it } from 'vitest'
import {
  AGENT_MAX_ITERATIONS_SYNTHESIS_PROMPT,
  MAX_AGENT_ITERATIONS
} from '../src/shared/agent/agentLimits'

describe('agentLimits', () => {
  it('allows enough iterations for multi-step PDF tasks', () => {
    expect(MAX_AGENT_ITERATIONS).toBeGreaterThanOrEqual(12)
  })

  it('synthesis prompt asks for Chinese partial answer', () => {
    expect(AGENT_MAX_ITERATIONS_SYNTHESIS_PROMPT).toMatch(/中文/)
    expect(AGENT_MAX_ITERATIONS_SYNTHESIS_PROMPT).toMatch(/已有/)
  })
})
