import type { Chat, ChatMessage, Credentials } from './types'

const CREDS_KEY = 'max-chat-credentials'

function dataKey(idInstance: string) {
  return `max-chat-data-${idInstance}`
}

interface StoredData {
  chats: Chat[]
  messages: Record<string, ChatMessage[]>
  activeChatId: string | null
}

export function loadCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    return raw ? (JSON.parse(raw) as Credentials) : null
  } catch {
    return null
  }
}

export function saveCredentials(creds: Credentials | null) {
  if (!creds) {
    localStorage.removeItem(CREDS_KEY)
    return
  }
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds))
}

export function loadChatData(idInstance: string): StoredData {
  try {
    const raw = localStorage.getItem(dataKey(idInstance))
    if (!raw) return { chats: [], messages: {}, activeChatId: null }
    const parsed = JSON.parse(raw) as StoredData
    return {
      chats: parsed.chats ?? [],
      messages: parsed.messages ?? {},
      activeChatId: parsed.activeChatId ?? null,
    }
  } catch {
    return { chats: [], messages: {}, activeChatId: null }
  }
}

export function saveChatData(idInstance: string, data: StoredData) {
  localStorage.setItem(dataKey(idInstance), JSON.stringify(data))
}

export function clearChatData(idInstance: string) {
  localStorage.removeItem(dataKey(idInstance))
}
