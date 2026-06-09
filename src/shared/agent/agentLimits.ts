/** Agent 单轮对话内 LLM↔工具 循环上限（每轮可含并行工具调用） */
export const MAX_AGENT_ITERATIONS = 16

export const AGENT_MAX_ITERATIONS_SYNTHESIS_PROMPT =
  '【系统提示】本轮工具调用次数已达上限。请仅根据对话中已有的工具返回结果，用中文给出尽可能完整的最终回答；' +
  '若信息不完整，说明已掌握的内容并列出尚未覆盖的部分，不要请求更多工具。'
