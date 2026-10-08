import { useState, type FormEvent } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (phone: string) => void | Promise<void>
  loading?: boolean
}

export function NewChatModal({ open, onClose, onCreate, loading }: Props) {
  const [phone, setPhone] = useState('')

  if (!open) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const value = phone.trim()
    if (!value || loading) return
    await onCreate(value)
    setPhone('')
  }

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose}>
      <form
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2>Новый чат</h2>
        <p>Номер телефона в международном формате, например +7 999 123-45-67</p>
        <label>
          Телефон
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 999 123-45-67"
            autoFocus
            required
            disabled={loading}
          />
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Отмена
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Проверка…' : 'Открыть чат'}
          </button>
        </div>
      </form>
    </div>
  )
}
