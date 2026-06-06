import { contextBridge, ipcRenderer } from 'electron'
import { formatPhoneDisplay, normalizePhoneNumber } from '../shared/webLibrary'
import type { WebPhoneEntry } from '../shared/webLibrary'

const PHONE_PICKER_ID = 'hanstudy-phone-picker'
const STYLE_ID = 'hanstudy-phone-autofill-style'

const phoneApi = {
  list: (): Promise<WebPhoneEntry[]> => ipcRenderer.invoke('webLibrary:listPhones'),
  save: (phone: string, origin: string): Promise<WebPhoneEntry[]> =>
    ipcRenderer.invoke('webLibrary:addPhone', phone, origin)
}

contextBridge.exposeInMainWorld('__hanstudyPhone', phoneApi)

function isPhoneField(input: HTMLInputElement): boolean {
  if (input.type === 'hidden' || input.type === 'password' || input.type === 'email') return false
  if (input.type === 'tel') return true
  const hint = [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label') ?? '',
    input.autocomplete
  ]
    .join(' ')
    .toLowerCase()
  return /phone|mobile|tel|cell|手机|电话|手机号|手机号码|联系电话/.test(hint)
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    #${PHONE_PICKER_ID} {
      position: fixed;
      z-index: 2147483646;
      min-width: 160px;
      max-width: 280px;
      padding: 4px;
      border-radius: 8px;
      border: 1px solid rgba(0,0,0,0.12);
      background: #fff;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      font: 13px/1.4 system-ui, sans-serif;
    }
    #${PHONE_PICKER_ID} button {
      display: block;
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-radius: 6px;
      background: transparent;
      text-align: left;
      cursor: pointer;
      color: #111;
    }
    #${PHONE_PICKER_ID} button:hover {
      background: rgba(0,0,0,0.06);
    }
  `
  document.head.appendChild(style)
}

function hidePicker(): void {
  document.getElementById(PHONE_PICKER_ID)?.remove()
}

function showPicker(input: HTMLInputElement, phones: WebPhoneEntry[]): void {
  hidePicker()
  if (phones.length === 0) return

  ensureStyles()
  const picker = document.createElement('div')
  picker.id = PHONE_PICKER_ID

  for (const entry of phones.slice(0, 8)) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = formatPhoneDisplay(entry.phone)
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      input.value = entry.phone
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      hidePicker()
    })
    picker.appendChild(btn)
  }

  const rect = input.getBoundingClientRect()
  picker.style.left = `${Math.max(8, rect.left)}px`
  picker.style.top = `${rect.bottom + 4}px`
  picker.style.width = `${Math.max(rect.width, 160)}px`
  document.body.appendChild(picker)
}

async function savePhoneValue(input: HTMLInputElement): Promise<void> {
  try {
    const normalized = normalizePhoneNumber(input.value)
    if (!normalized) return
    const origin = location.origin && location.origin !== 'null' ? location.origin : location.href
    await phoneApi.save(normalized, origin)
  } catch {
    // ignore IPC failures
  }
}

function bindPhoneInput(input: HTMLInputElement): void {
  if (input.dataset.hanstudyPhoneBound === '1') return
  input.dataset.hanstudyPhoneBound = '1'

  input.addEventListener('focus', () => {
    void phoneApi.list().then((phones) => showPicker(input, phones)).catch(() => {})
  })

  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      hidePicker()
      void savePhoneValue(input)
    }, 120)
  })

  input.addEventListener('change', () => {
    void savePhoneValue(input)
  })
}

function scanPhoneInputs(): void {
  document.querySelectorAll('input').forEach((node) => {
    const input = node as HTMLInputElement
    if (isPhoneField(input)) bindPhoneInput(input)
  })
}

function initPhoneAutofill(): void {
  ensureStyles()
  scanPhoneInputs()
  new MutationObserver(() => scanPhoneInputs()).observe(document.documentElement, {
    childList: true,
    subtree: true
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPhoneAutofill)
} else {
  initPhoneAutofill()
}
