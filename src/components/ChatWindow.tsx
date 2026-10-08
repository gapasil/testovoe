import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Chat, ChatMessage } from '../types'
import { EmojiPicker } from './EmojiPicker'

interface Props {
  chat: Chat | null
  messages: ChatMessage[]
  onSend: (text: string) => Promise<void>
  sending: boolean
  onBack?: () => void
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ChatWindow({ chat, messages, onSend, sending, onBack }: Props) {
  const [text, setText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, chat?.id])

  useEffect(() => {
    setEmojiOpen(false)
    if (chat) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [chat?.id])

  if (!chat) {
    return (
      <section className="chat-window empty">
        <div className="placeholder">
          <div className="logo-mark lg">M</div>
          <h2>MAX Chat</h2>
          <p>Выберите чат или создайте новый по номеру телефона</p>
        </div>
      </section>
    )
  }

  const focusInput = () => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    const value = text.trim()
    if (!value || sending) return
    setText('')
    setEmojiOpen(false)
    focusInput()
    try {
      await onSend(value)
    } finally {
      focusInput()
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current
    if (!el) {
      setText((prev) => prev + emoji)
      return
    }
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    const next = text.slice(0, start) + emoji + text.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <section className="chat-window">
      <header className="chat-header">
        {onBack && (
          <button type="button" className="icon-btn ghost back-btn" onClick={onBack} aria-label="Назад">
            ←
          </button>
        )}
        <div className="avatar">{chat.title.slice(0, 1).toUpperCase()}</div>
        <div className="chat-header-meta">
          <strong>{chat.title}</strong>
          <span>{chat.phone}</span>
        </div>
      </header>

      <div className="messages" ref={listRef}>
        <div className="messages-inner">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`bubble ${msg.direction} ${msg.status === 'failed' ? 'failed' : ''}`}
            >
              <p className="emoji-text">{msg.text}</p>
              <footer>
                <time>{formatTime(msg.timestamp)}</time>
                {msg.direction === 'outgoing' && (
                  <span className="status">
                    {msg.status === 'sending' ? '…' : msg.status === 'failed' ? '!' : '✓'}
                  </span>
                )}
              </footer>
            </div>
          ))}
        </div>
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <div className="composer-wrap">
          <EmojiPicker
            open={emojiOpen}
            onClose={() => setEmojiOpen(false)}
            onPick={insertEmoji}
          />
          <button
            type="button"
            className="icon-btn ghost emoji-toggle"
            onClick={() => setEmojiOpen((v) => !v)}
            aria-label="Эмодзи"
          >
            😊
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Введите сообщение"
            maxLength={4000}
            rows={1}
            enterKeyHint="send"
          />
          <button type="submit" className="send-btn" disabled={!text.trim() || sending}>
            ➤
          </button>
        </div>
      </form>
    </section>
  )
}
