import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { notificationPoller } from './api/notificationPoller'
import {
  checkAccount,
  getSettings,
  normalizePhone,
  sendMessage,
  setSettings,
} from './api/greenApi'
import { ChatWindow } from './components/ChatWindow'
import { LoginScreen } from './components/LoginScreen'
import { NewChatModal } from './components/NewChatModal'
import { Sidebar } from './components/Sidebar'
import { useNotificationPolling } from './hooks/useNotificationPolling'
import {
  loadChatData,
  loadCredentials,
  saveChatData,
  saveCredentials,
} from './storage'
import type { Chat, ChatMessage, Credentials, NotificationBody } from './types'
import './App.css'

function extractText(body: NotificationBody): string | null {
  const data = body.messageData
  if (!data) return null
  if (data.typeMessage === 'textMessage') {
    return data.textMessageData?.textMessage ?? null
  }
  if (data.typeMessage === 'extendedTextMessage') {
    return data.extendedTextMessageData?.text ?? null
  }
  const anyData = data as Record<string, unknown>
  for (const key of Object.keys(anyData)) {
    const nested = anyData[key]
    if (nested && typeof nested === 'object') {
      const obj = nested as Record<string, unknown>
      if (typeof obj.textMessage === 'string') return obj.textMessage
      if (typeof obj.text === 'string') return obj.text
    }
  }
  return null
}

function initialFromStorage(creds: Credentials | null) {
  if (!creds) {
    return {
      chats: [] as Chat[],
      messages: {} as Record<string, ChatMessage[]>,
      activeChatId: null as string | null,
    }
  }
  return loadChatData(creds.idInstance)
}

export default function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(loadCredentials)
  const initial = initialFromStorage(credentials)
  const [chats, setChats] = useState<Chat[]>(initial.chats)
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(initial.messages)
  const [activeChatId, setActiveChatId] = useState<string | null>(initial.activeChatId)
  const [modalOpen, setModalOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches,
  )
  const chatsRef = useRef<Chat[]>([])
  const messagesRef = useRef<Record<string, ChatMessage[]>>({})
  chatsRef.current = chats
  messagesRef.current = messages

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!credentials) return
    saveChatData(credentials.idInstance, { chats, messages, activeChatId })
  }, [credentials, chats, messages, activeChatId])

  useEffect(() => {
    if (!credentials) return
    const legacy = chats.filter((c) => c.id.includes('@c.us'))
    if (legacy.length === 0) return

    let cancelled = false
    ;(async () => {
      for (const chat of legacy) {
        try {
          const result = await checkAccount(credentials, chat.phone)
          if (cancelled || !result.exist || !result.chatId) continue
          if (result.chatId === chat.id) continue

          setChats((prev) =>
            prev
              .filter((c) => c.id !== chat.id)
              .concat({
                ...chat,
                id: result.chatId,
                updatedAt: Date.now(),
              })
              .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i),
          )
          setMessages((prev) => {
            const moved = prev[chat.id] ?? []
            const next = { ...prev }
            delete next[chat.id]
            next[result.chatId] = [
              ...(next[result.chatId] ?? []),
              ...moved.map((m) => ({ ...m, chatId: result.chatId })),
            ]
            return next
          })
          setActiveChatId((id) => (id === chat.id ? result.chatId : id))
        } catch {
          void 0
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [credentials, credentials?.idInstance, chats.map((c) => c.id).join('|')])

  const upsertChat = useCallback((chat: Chat) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === chat.id)
      if (idx === -1) return [...prev, chat]
      const next = [...prev]
      next[idx] = { ...next[idx], ...chat }
      return next
    })
  }, [])

  const appendMessage = useCallback((chatId: string, message: ChatMessage) => {
    setMessages((prev) => {
      const list = prev[chatId] ?? []
      if (list.some((m) => m.id === message.id)) return prev
      return { ...prev, [chatId]: [...list, message] }
    })
  }, [])

  const prepareReceiving = async (creds: Credentials) => {
    try {
      await setSettings(creds)
      const settings = await getSettings(creds)
      const webhook = String(settings.webhookUrl ?? '')
      if (webhook) {
        setError(
          `webhookUrl не пустой («${webhook}»). Очистите его в кабинете GREEN-API — иначе HTTP API не отдаёт уведомления.`,
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(
        `Не удалось настроить приём (очистите webhookUrl в кабинете): ${message}`,
      )
    }
  }

  useEffect(() => {
    if (!credentials) return
    void prepareReceiving(credentials)
  }, [credentials?.idInstance, credentials?.apiTokenInstance, credentials?.apiUrl])

  const handleLogin = async (creds: Credentials) => {
    saveCredentials(creds)
    const data = loadChatData(creds.idInstance)
    setChats(data.chats)
    setMessages(data.messages)
    setActiveChatId(data.activeChatId)
    setCredentials(creds)
    setError(null)
  }

  const handleLogout = () => {
    notificationPoller.stop()
    saveCredentials(null)
    setCredentials(null)
    setChats([])
    setMessages({})
    setActiveChatId(null)
  }

  const handleCreateChat = async (phoneInput: string) => {
    if (!credentials) return
    const phone = normalizePhone(phoneInput)
    if (phone.length < 10) {
      setError('Введите корректный номер телефона')
      return
    }

    setCreating(true)
    setError(null)
    try {
      const result = await checkAccount(credentials, phone)
      if (!result.exist || !result.chatId) {
        throw new Error('Аккаунт MAX на этом номере не найден')
      }

      const existing = chatsRef.current.find((c) => c.id === result.chatId)
      upsertChat({
        id: result.chatId,
        phone: `+${phone}`,
        title: existing?.title || `+${phone}`,
        lastMessage: existing?.lastMessage,
        updatedAt: Date.now(),
      })
      setActiveChatId(result.chatId)
      setModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleSend = async (text: string) => {
    if (!credentials || !activeChatId) return
    const tempId = `local-${Date.now()}`
    const current = chatsRef.current.find((c) => c.id === activeChatId)
    const outgoing: ChatMessage = {
      id: tempId,
      chatId: activeChatId,
      text,
      timestamp: Date.now(),
      direction: 'outgoing',
      status: 'sending',
    }
    appendMessage(activeChatId, outgoing)
    upsertChat({
      id: activeChatId,
      phone: current?.phone ?? activeChatId,
      title: current?.title ?? activeChatId,
      lastMessage: text,
      updatedAt: Date.now(),
    })

    setSending(true)
    setError(null)
    try {
      const { idMessage } = await sendMessage(credentials, activeChatId, text)
      setMessages((prev) => ({
        ...prev,
        [activeChatId]: (prev[activeChatId] ?? []).map((m) =>
          m.id === tempId ? { ...m, id: idMessage, status: 'sent' } : m,
        ),
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setMessages((prev) => ({
        ...prev,
        [activeChatId]: (prev[activeChatId] ?? []).map((m) =>
          m.id === tempId ? { ...m, status: 'failed' } : m,
        ),
      }))
    } finally {
      setSending(false)
    }
  }

  const handleNotification = useCallback(
    (body: NotificationBody) => {
      const isIncoming = body.typeWebhook === 'incomingMessageReceived'
      const isOutgoing =
        body.typeWebhook === 'outgoingMessageReceived' ||
        body.typeWebhook === 'outgoingAPIMessageReceived'

      if (!isIncoming && !isOutgoing) return

      const text =
        extractText(body) ||
        (isIncoming ? `[${body.messageData?.typeMessage || 'сообщение'}]` : null)
      if (!text) return

      const remoteChatId = body.senderData?.chatId || body.senderData?.sender || ''
      if (!remoteChatId) return

      const phoneRaw = body.senderData?.senderPhoneNumber
      const phoneDigits =
        phoneRaw && String(phoneRaw) !== '0'
          ? normalizePhone(String(phoneRaw))
          : ''
      const phone = phoneDigits ? `+${phoneDigits}` : remoteChatId
      const title =
        body.senderData?.senderName || body.senderData?.chatName || phone

      const existing =
        chatsRef.current.find((c) => c.id === remoteChatId) ||
        (phoneDigits
          ? chatsRef.current.find((c) => normalizePhone(c.phone) === phoneDigits)
          : undefined)

      const chatId = isIncoming ? remoteChatId : existing?.id ?? remoteChatId
      const nextTitle =
        title && !title.startsWith('+') ? title : existing?.title || title

      if (isOutgoing) {
        const list = messagesRef.current[chatId] ?? []
        if (
          list.some((m) => m.id === body.idMessage) ||
          list.some(
            (m) =>
              m.direction === 'outgoing' &&
              m.text === text &&
              Date.now() - m.timestamp < 20000,
          )
        ) {
          return
        }
      }

      if (isIncoming && existing && existing.id !== remoteChatId) {
        setChats((prev) => prev.filter((c) => c.id !== existing.id))
        setMessages((prev) => {
          const moved = prev[existing.id] ?? []
          const next = { ...prev }
          delete next[existing.id]
          next[remoteChatId] = [
            ...(next[remoteChatId] ?? []),
            ...moved.map((m) => ({ ...m, chatId: remoteChatId })),
          ]
          return next
        })
        setActiveChatId((id) => (id === existing.id ? remoteChatId : id))
      }

      upsertChat({
        id: chatId,
        phone: existing?.phone || phone,
        title: nextTitle,
        lastMessage: text,
        updatedAt: (body.timestamp || Date.now() / 1000) * 1000,
      })

      if (isIncoming && !activeChatId) {
        setActiveChatId(chatId)
      }

      appendMessage(chatId, {
        id: body.idMessage || `evt-${Date.now()}`,
        chatId,
        text,
        timestamp: (body.timestamp || Date.now() / 1000) * 1000,
        direction: isIncoming ? 'incoming' : 'outgoing',
        status: 'sent',
      })
    },
    [activeChatId, appendMessage, upsertChat],
  )

  const pollStatus = useNotificationPolling({
    credentials,
    enabled: Boolean(credentials),
    onNotification: handleNotification,
    onError: (err) => setError(err.message),
  })

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId],
  )

  const activeMessages = activeChatId ? (messages[activeChatId] ?? []) : []

  if (!credentials) {
    return <LoginScreen onSubmit={handleLogin} />
  }

  return (
    <div className={`app-shell ${activeChatId ? 'chat-open' : ''}`}>
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelect={setActiveChatId}
        onNewChat={() => setModalOpen(true)}
        onLogout={handleLogout}
        pollStatus={pollStatus}
      />
      <ChatWindow
        chat={activeChat}
        messages={activeMessages}
        onSend={handleSend}
        sending={sending}
        onBack={isMobile && activeChatId ? () => setActiveChatId(null) : undefined}
      />
      <NewChatModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateChat}
        loading={creating}
      />
      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}
