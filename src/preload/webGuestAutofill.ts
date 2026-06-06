import { ipcRenderer } from 'electron'
import { formatPhoneDisplay, normalizePhoneNumber } from '../shared/webLibrary'
import type { SaveWebCredentialInput, WebCredentialItem, WebPhoneEntry } from '../shared/webLibrary'

const PICKER_CLASS = 'hanstudy-autofill-picker'
const STYLE_ID = 'hanstudy-autofill-style'

const phoneApi = {
  list: (): Promise<WebPhoneEntry[]> => ipcRenderer.invoke('webLibrary:listPhones'),
  save: (phone: string, origin: string): Promise<WebPhoneEntry[]> =>
    ipcRenderer.invoke('webLibrary:addPhone', phone, origin)
}

const credApi = {
  listForOrigin: (origin: string): Promise<WebCredentialItem[]> =>
    ipcRenderer.invoke('webLibrary:listCredentialsForOrigin', origin),
  getPassword: (id: string): Promise<string> =>
    ipcRenderer.invoke('webLibrary:getCredentialPassword', id),
  save: (input: SaveWebCredentialInput): Promise<WebCredentialItem[]> =>
    ipcRenderer.invoke('webLibrary:saveCredential', input)
}

function pageOrigin(): string {
  return location.origin && location.origin !== 'null' ? location.origin : location.href
}

function fieldHint(input: HTMLInputElement): string {
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label') ?? '',
    input.autocomplete
  ]
    .join(' ')
    .toLowerCase()
}

function isPhoneField(input: HTMLInputElement): boolean {
  if (input.type === 'hidden' || input.type === 'password' || input.type === 'email') return false
  if (input.type === 'tel') return true
  return /phone|mobile|tel|cell|手机|电话|手机号|手机号码|联系电话/.test(fieldHint(input))
}

function isUsernameField(input: HTMLInputElement): boolean {
  if (input.type === 'password' || input.type === 'hidden' || input.type === 'tel') return false
  if (isPhoneField(input)) return false
  if (input.type === 'email') return true
  const autocomplete = (input.autocomplete || '').toLowerCase()
  if (autocomplete === 'username' || autocomplete === 'email') return true
  return /user|login|account|email|mail|name|账号|用户名|邮箱|账户|登陆/.test(fieldHint(input))
}

function isPasswordField(input: HTMLInputElement): boolean {
  return input.type === 'password'
}

function findFieldRoot(input: HTMLInputElement): HTMLElement {
  return (
    input.form ??
    input.closest('form') ??
    input.closest('[class*="login"], [class*="sign"], [class*="auth"]') ??
    input.parentElement ??
    document.body
  )
}

function findUsernameField(root: ParentNode): HTMLInputElement | null {
  const nodes = root.querySelectorAll('input')
  for (let i = 0; i < nodes.length; i++) {
    const input = nodes[i] as HTMLInputElement
    if (isUsernameField(input)) return input
  }
  return null
}

function findPasswordField(root: ParentNode): HTMLInputElement | null {
  const nodes = root.querySelectorAll('input[type="password"]')
  return nodes.length > 0 ? (nodes[0] as HTMLInputElement) : null
}

function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .${PICKER_CLASS} {
      position: fixed;
      z-index: 2147483646;
      min-width: 180px;
      max-width: 320px;
      padding: 4px;
      border-radius: 8px;
      border: 1px solid rgba(0,0,0,0.12);
      background: #fff;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      font: 13px/1.4 system-ui, sans-serif;
    }
    .${PICKER_CLASS} button {
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
    .${PICKER_CLASS} button:hover {
      background: rgba(0,0,0,0.06);
    }
    .${PICKER_CLASS} .hanstudy-picker-sub {
      display: block;
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }
  `
  document.head.appendChild(style)
}

let activePicker: HTMLElement | null = null

function hidePicker(): void {
  activePicker?.remove()
  activePicker = null
}

interface PickerOption {
  label: string
  sublabel?: string
  onSelect: () => void
}

function showPicker(anchor: HTMLElement, options: PickerOption[]): void {
  hidePicker()
  if (options.length === 0) return

  ensureStyles()
  const picker = document.createElement('div')
  picker.className = PICKER_CLASS

  for (const option of options.slice(0, 8)) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = option.label
    if (option.sublabel) {
      const sub = document.createElement('span')
      sub.className = 'hanstudy-picker-sub'
      sub.textContent = option.sublabel
      btn.appendChild(sub)
    }
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      option.onSelect()
      hidePicker()
    })
    picker.appendChild(btn)
  }

  const rect = anchor.getBoundingClientRect()
  picker.style.left = `${Math.max(8, rect.left)}px`
  picker.style.top = `${rect.bottom + 4}px`
  picker.style.width = `${Math.max(rect.width, 180)}px`
  document.body.appendChild(picker)
  activePicker = picker
}

async function fillCredential(
  cred: WebCredentialItem,
  root: ParentNode,
  focusInput?: HTMLInputElement
): Promise<void> {
  const usernameInput = findUsernameField(root) ?? (isUsernameField(focusInput!) ? focusInput : null)
  const passwordInput = findPasswordField(root)
  if (usernameInput) setInputValue(usernameInput, cred.username)
  if (passwordInput) {
    try {
      const password = await credApi.getPassword(cred.id)
      if (password) setInputValue(passwordInput, password)
    } catch {
      // ignore
    }
  }
}

async function showCredentialPicker(input: HTMLInputElement): Promise<void> {
  try {
    const creds = await credApi.listForOrigin(pageOrigin())
    if (creds.length === 0) return
    const root = findFieldRoot(input)
    showPicker(
      input,
      creds.map((cred) => ({
        label: cred.label || cred.username,
        sublabel: cred.username !== (cred.label || cred.username) ? cred.username : undefined,
        onSelect: () => {
          void fillCredential(cred, root, input)
        }
      }))
    )
  } catch {
    // ignore
  }
}

async function savePhoneValue(input: HTMLInputElement): Promise<void> {
  try {
    const normalized = normalizePhoneNumber(input.value)
    if (!normalized) return
    await phoneApi.save(normalized, pageOrigin())
  } catch {
    // ignore
  }
}

async function saveCredentialsFromRoot(root: ParentNode): Promise<void> {
  const usernameInput = findUsernameField(root)
  const passwordInput = findPasswordField(root)
  const username = usernameInput?.value.trim()
  const password = passwordInput?.value
  if (!username || !password) return
  try {
    await credApi.save({ origin: pageOrigin(), username, password })
  } catch {
    // ignore
  }
}

function bindPhoneInput(input: HTMLInputElement): void {
  if (input.dataset.hanstudyPhoneBound === '1') return
  input.dataset.hanstudyPhoneBound = '1'

  input.addEventListener('focus', () => {
    void phoneApi
      .list()
      .then((phones) =>
        showPicker(
          input,
          phones.map((entry) => ({
            label: formatPhoneDisplay(entry.phone),
            onSelect: () => setInputValue(input, entry.phone)
          }))
        )
      )
      .catch(() => {})
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

function bindCredentialInput(input: HTMLInputElement): void {
  if (input.dataset.hanstudyCredBound === '1') return
  input.dataset.hanstudyCredBound = '1'

  input.addEventListener('focus', () => {
    void showCredentialPicker(input)
  })

  input.addEventListener('blur', () => {
    window.setTimeout(hidePicker, 120)
  })
}

function scanInputs(): void {
  document.querySelectorAll('input').forEach((node) => {
    const input = node as HTMLInputElement
    if (isPhoneField(input)) bindPhoneInput(input)
    else if (isUsernameField(input) || isPasswordField(input)) bindCredentialInput(input)
  })
}

function initAutofill(): void {
  ensureStyles()
  scanInputs()

  document.addEventListener(
    'submit',
    (event) => {
      const target = event.target
      if (target instanceof HTMLFormElement) {
        void saveCredentialsFromRoot(target)
      }
    },
    true
  )

  new MutationObserver(() => scanInputs()).observe(document.documentElement, {
    childList: true,
    subtree: true
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleAutofill, { once: true })
} else {
  scheduleAutofill()
}

function scheduleAutofill(): void {
  const run = (): void => initAutofill()
  const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(run, { timeout: 1500 })
  } else {
    window.setTimeout(run, 400)
  }
}
