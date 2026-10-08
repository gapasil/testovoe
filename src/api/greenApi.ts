import type { Credentials, ReceiveNotificationResponse } from '../types'

function apiHost(apiUrl: string) {
  return new URL(apiUrl).host
}

export function buildApiUrl(creds: Credentials, methodPath: string): string {
  const path = `/waInstance${creds.idInstance}/${methodPath}`
  if (import.meta.env.DEV) {
    return `/__green__/${apiHost(creds.apiUrl)}${path}`
  }
  return `${creds.apiUrl.replace(/\/$/, '')}${path}`
}

async function parseError(res: Response): Promise<never> {
  let details = res.statusText
  try {
    const data = await res.json()
    details =
      data.message ||
      data.error ||
      (typeof data === 'string' ? data : JSON.stringify(data))
  } catch {
    try {
      details = await res.text()
    } catch {
      void 0
    }
  }
  throw new Error(`GREEN-API ${res.status}: ${details}`)
}

export async function sendMessage(
  creds: Credentials,
  chatId: string,
  message: string,
): Promise<{ idMessage: string }> {
  const url = buildApiUrl(creds, `sendMessage/${creds.apiTokenInstance}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  })
  if (!res.ok) await parseError(res)
  return res.json()
}

export async function receiveNotification(
  creds: Credentials,
  receiveTimeout = 5,
  signal?: AbortSignal,
): Promise<ReceiveNotificationResponse | null> {
  const url = buildApiUrl(
    creds,
    `receiveNotification/${creds.apiTokenInstance}?receiveTimeout=${receiveTimeout}`,
  )
  const res = await fetch(url, { method: 'GET', signal })
  if (!res.ok) await parseError(res)
  const text = await res.text()
  if (!text || text === 'null' || text.trim() === '') return null
  return JSON.parse(text) as ReceiveNotificationResponse
}

export async function deleteNotification(
  creds: Credentials,
  receiptId: number,
): Promise<void> {
  const url = buildApiUrl(
    creds,
    `deleteNotification/${creds.apiTokenInstance}/${receiptId}`,
  )
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) await parseError(res)
}

export async function checkAccount(
  creds: Credentials,
  phoneNumber: string,
): Promise<{ exist: boolean; chatId: string }> {
  const url = buildApiUrl(creds, `checkAccount/${creds.apiTokenInstance}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: Number(normalizePhone(phoneNumber)),
      force: true,
    }),
  })
  if (!res.ok) await parseError(res)
  return res.json()
}

export async function setSettings(creds: Credentials): Promise<void> {
  const url = buildApiUrl(creds, `setSettings/${creds.apiTokenInstance}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookUrl: '',
      webhookUrlToken: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'yes',
      outgoingAPIMessageWebhook: 'yes',
      outgoingMessageWebhook: 'yes',
      stateWebhook: 'yes',
      incomingBlockWebhook: 'no',
      incomingCallWebhook: 'no',
    }),
  })
  if (!res.ok) await parseError(res)
}

export async function getSettings(
  creds: Credentials,
): Promise<Record<string, unknown>> {
  const url = buildApiUrl(creds, `getSettings/${creds.apiTokenInstance}`)
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) await parseError(res)
  return res.json()
}

export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`
  }
  return digits
}

export function guessApiUrl(idInstance: string): string {
  const prefix = idInstance.replace(/\D/g, '').slice(0, 4)
  if (prefix.length === 4) {
    return `https://${prefix}.api.green-api.com`
  }
  return 'https://api.green-api.com'
}
