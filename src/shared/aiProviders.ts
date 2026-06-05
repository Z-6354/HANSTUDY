export interface AIProviderModel {
  id: string
  label: string
  description?: string
  contextWindow?: number
  supportsThinking?: boolean
  defaultThinking?: boolean
}

export interface AIProvider {
  id: string
  name: string
  baseUrl: string
  models: AIProviderModel[]
  defaultModel: string
  /** 模型需用户手动填写（如火山方舟 Endpoint ID） */
  manualModel?: boolean
  apiKeyHint?: string
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      {
        id: 'deepseek-v4-flash',
        label: 'DeepSeek-V4-Flash',
        description: '超低抵扣系数，快捷经济，默认开启深度思考',
        contextWindow: 128000,
        supportsThinking: true,
        defaultThinking: true
      },
      {
        id: 'deepseek-v4-pro',
        label: 'DeepSeek-V4-Pro',
        description: 'Agent 能力增强，适合复杂问题，抵扣系数较高',
        contextWindow: 128000,
        supportsThinking: true,
        defaultThinking: true
      },
      { id: 'deepseek-reasoner', label: 'deepseek-r1（推理）', supportsThinking: true, defaultThinking: true },
      { id: 'deepseek-chat', label: 'deepseek-chat（对话 V3）' }
    ],
    defaultModel: 'deepseek-v4-flash',
    apiKeyHint: '在 platform.deepseek.com 获取 API Key'
  },
  {
    id: 'iflytek',
    name: '讯飞星火',
    baseUrl: 'https://spark-api-open.xf-yun.com/v1',
    models: [
      { id: '4.0Ultra', label: '4.0 Ultra' },
      { id: 'generalv3.5', label: 'generalv3.5' },
      { id: 'generalv3', label: 'generalv3' },
      { id: 'spark-max', label: 'spark-max' },
      { id: 'spark-pro', label: 'spark-pro' },
      { id: 'spark-lite', label: 'spark-lite' }
    ],
    defaultModel: 'generalv3.5',
    apiKeyHint: '在讯飞开放平台控制台获取 APIPassword（作为密钥填入）'
  },
  {
    id: 'volcengine',
    name: '火山引擎（方舟 Plan）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/plan/v3',
    models: [
      {
        id: 'ark-code-latest',
        label: 'ark-code-latest（路由）',
        description:
          'Agent Plan 推荐路由模型，后台可切换实际模型，需先在控制台配置默认模型',
        contextWindow: 128000,
        supportsThinking: true,
        defaultThinking: true
      },
      {
        id: 'deepseek-v4-flash',
        label: 'DeepSeek-V4-Flash',
        description:
          '【超低抵扣系数】快捷经济的 API 服务，默认开启深度思考，支持手动关闭',
        contextWindow: 128000,
        supportsThinking: true,
        defaultThinking: true
      },
      {
        id: 'deepseek-v4-pro',
        label: 'DeepSeek-V4-Pro',
        description:
          '【抵扣系数较高】Agent 能力显著增强，推荐复杂问题或关闭深度思考，默认开启 thinking',
        contextWindow: 128000,
        supportsThinking: true,
        defaultThinking: true
      },
      {
        id: 'glm-5.1',
        label: 'GLM-5.1',
        description:
          '【抵扣系数较高，额度消耗快】智谱新一代旗舰，推荐重难点复杂任务或关闭深度思考，默认 thinking',
        contextWindow: 128000,
        supportsThinking: true,
        defaultThinking: true
      },
      {
        id: 'minimax-m2.7',
        label: 'MiniMax-M2.7',
        description:
          'M2.7 可构建复杂 Agent Harness，完成高度复杂的生产力任务，默认 thinking，支持关闭',
        contextWindow: 200000,
        supportsThinking: true,
        defaultThinking: true
      },
      {
        id: 'kimi-k2.6',
        label: 'Kimi-K2.6',
        description: 'Kimi 新一代模型，默认 thinking，支持关闭深度思考',
        contextWindow: 128000,
        supportsThinking: true,
        defaultThinking: true
      }
    ],
    defaultModel: 'deepseek-v4-flash',
    manualModel: true,
    apiKeyHint:
      'Agent Plan 个人版：在方舟控制台 Plan 页创建 API Key（ark- 开头，勿与 Coding Plan 混用）。' +
      '模型可填 deepseek-v4-flash、ark-code-latest 或 ep-xxx。' +
      'OpenAI 兼容地址：https://ark.cn-beijing.volces.com/api/plan/v3'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini' },
      { id: 'gpt-4o', label: 'gpt-4o' },
      { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini' }
    ],
    defaultModel: 'gpt-4o-mini'
  },
  {
    id: 'moonshot',
    name: 'Moonshot（Kimi）',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: [
      {
        id: 'kimi-k2.6',
        label: 'Kimi-K2.6',
        description: 'Kimi 新一代模型，默认 thinking',
        contextWindow: 128000,
        supportsThinking: true,
        defaultThinking: true
      },
      { id: 'moonshot-v1-8k', label: 'moonshot-v1-8k', contextWindow: 8000 },
      { id: 'moonshot-v1-32k', label: 'moonshot-v1-32k', contextWindow: 32000 },
      { id: 'moonshot-v1-128k', label: 'moonshot-v1-128k', contextWindow: 128000 }
    ],
    defaultModel: 'kimi-k2.6'
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      {
        id: 'glm-5.1',
        label: 'GLM-5.1',
        description: '智谱新一代旗舰，默认 thinking，适合复杂任务',
        contextWindow: 128000,
        supportsThinking: true,
        defaultThinking: true
      },
      { id: 'glm-4-flash', label: 'glm-4-flash', contextWindow: 128000 },
      { id: 'glm-4-plus', label: 'glm-4-plus', contextWindow: 128000 }
    ],
    defaultModel: 'glm-5.1'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    models: [
      {
        id: 'MiniMax-M2.7',
        label: 'MiniMax-M2.7',
        description: '复杂 Agent / Skills / Tool 任务，默认 thinking',
        contextWindow: 200000,
        supportsThinking: true,
        defaultThinking: true
      },
      {
        id: 'MiniMax-M3',
        label: 'MiniMax-M3',
        description: 'Coding / Agentic SOTA，1M 上下文',
        contextWindow: 1000000,
        supportsThinking: true,
        defaultThinking: true
      }
    ],
    defaultModel: 'MiniMax-M2.7',
    apiKeyHint: '在 MiniMax 开放平台获取 API Key'
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    models: [],
    defaultModel: '',
    manualModel: true
  }
]

const PROVIDER_HOSTS: Record<string, string> = {
  deepseek: 'deepseek.com',
  iflytek: 'xf-yun.com',
  volcengine: 'volces.com',
  openai: 'openai.com',
  moonshot: 'moonshot.cn',
  zhipu: 'bigmodel.cn',
  minimax: 'minimaxi.com'
}

export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id)
}

export function getModelMeta(modelId: string): AIProviderModel | undefined {
  for (const provider of AI_PROVIDERS) {
    const model = provider.models.find((m) => m.id === modelId)
    if (model) return model
  }
  return undefined
}

export function modelSupportsThinking(modelId: string): boolean {
  return getModelMeta(modelId)?.supportsThinking ?? false
}

export function inferProviderId(baseUrl: string): string {
  const normalized = baseUrl.trim().toLowerCase()
  if (!normalized) return DEFAULT_PROVIDER_ID
  for (const [id, host] of Object.entries(PROVIDER_HOSTS)) {
    if (normalized.includes(host)) return id
  }
  return 'custom'
}

export const DEFAULT_PROVIDER_ID = 'deepseek'

export function getDefaultAISettings(): Omit<import('./types').AISettings, 'apiKey'> {
  const provider = getProviderById(DEFAULT_PROVIDER_ID)!
  return {
    provider: provider.id,
    baseUrl: provider.baseUrl,
    model: provider.defaultModel
  }
}
