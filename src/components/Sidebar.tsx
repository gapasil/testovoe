import type { PollStatus } from '../hooks/useNotificationPolling'
import type { Chat } from '../types'

interface Props {
  chats: Chat[]
  activeChatId: string | null
  onSelect: (chatId: string) => void
  onNewChat: () => void
  onLogout: () => void
  pollStatus: PollStatus
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusLabel: Record<PollStatus, string> = {
  idle: 'офлайн',
  listening: 'приём включён',
  error: 'ошибка приёма',
}

export function Sidebar({
  chats,
  activeChatId,
  onSelect,
  onNewChat,
  onLogout,
  pollStatus,
}: Props) {
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="sidebar-title">
          <span className="logo-mark sm">M</span>
          <div>
            <span>Чаты</span>
            <small className={`poll-status ${pollStatus}`}>
              {statusLabel[pollStatus]}
            </small>
          </div>
        </div>
        <div className="sidebar-actions">
          <button type="button" className="icon-btn" onClick={onNewChat} title="Новый чат">
            +
          </button>
          <button type="button" className="icon-btn ghost" onClick={onLogout} title="Выйти">
            ⎋
          </button>
        </div>
      </header>

      <div className="chat-list">
        {sorted.length === 0 && (
          <div className="empty-chats">
            Нет чатов. Нажмите «+», чтобы написать по номеру телефона.
          </div>
        )}
        {sorted.map((chat) => (
          <button
            key={chat.id}
            type="button"
            className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
            onClick={() => onSelect(chat.id)}
          >
            <div className="avatar">{chat.title.slice(0, 1).toUpperCase()}</div>
            <div className="chat-item-body">
              <div className="chat-item-top">
                <strong>{chat.title}</strong>
                <span>{formatTime(chat.updatedAt)}</span>
              </div>
              <p>{chat.lastMessage || 'Нет сообщений'}</p>
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}
