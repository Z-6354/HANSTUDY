import { app } from 'electron'
import type { FeedbackSubmitPayload, FeedbackSubmitResult } from '../../shared/feedback'
import { resolveFeedbackApiUrl, validateFeedbackPayload } from '../../shared/feedback'

export async function submitFeedback(
  payload: FeedbackSubmitPayload
): Promise<FeedbackSubmitResult> {
  const err = validateFeedbackPayload(payload)
  if (err) return { ok: false, message: err }

  const base = resolveFeedbackApiUrl(
    process.env.HANSTUDY_FEEDBACK_API || import.meta.env.MAIN_VITE_FEEDBACK_API_URL
  )
  const url = `${base}/api/feedback`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        title: payload.title.trim(),
        description: payload.description.trim(),
        contact: payload.contact?.trim() || undefined,
        submittedAt: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(30_000)
    })
    const text = await res.text()
    let body: { id?: string; message?: string; error?: string } = {}
    try {
      body = text ? (JSON.parse(text) as typeof body) : {}
    } catch {
      body = { message: text }
    }
    if (!res.ok) {
      return {
        ok: false,
        message: body.error || body.message || `服务器错误 (${res.status})`
      }
    }
    return {
      ok: true,
      id: body.id,
      message: body.message || '提交成功，感谢反馈！'
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `无法连接反馈服务器：${msg}` }
  }
}

export function getFeedbackClientMeta(): Pick<
  FeedbackSubmitPayload,
  'appVersion' | 'platform' | 'clientId'
> {
  return {
    appVersion: app.getVersion(),
    platform: `${process.platform} ${process.arch}`,
    clientId: app.getPath('userData').replace(/\\/g, '/').slice(-32)
  }
}
