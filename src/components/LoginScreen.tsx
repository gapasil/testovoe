import { useState, type FormEvent } from 'react'
import { guessApiUrl } from '../api/greenApi'
import type { Credentials } from '../types'

interface Props {
  onSubmit: (creds: Credentials) => void | Promise<void>
}

export function LoginScreen({ onSubmit }: Props) {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [apiUrl, setApiUrl] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const id = idInstance.trim()
    const token = apiTokenInstance.trim()
    if (!id || !token) return

    onSubmit({
      idInstance: id,
      apiTokenInstance: token,
      apiUrl: (apiUrl.trim() || guessApiUrl(id)).replace(/\/$/, ''),
    })
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="logo-mark">M</div>
          <div>
            <h1>MAX Chat</h1>
            <p>Тестовый веб-клиент на GREEN-API</p>
          </div>
        </div>

        <label>
          idInstance
          <input
            value={idInstance}
            onChange={(e) => {
              setIdInstance(e.target.value)
              if (!apiUrl) setApiUrl(guessApiUrl(e.target.value))
            }}
            placeholder="3100123456"
            autoComplete="username"
            required
          />
        </label>

        <label>
          apiTokenInstance
          <input
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            placeholder="Токен из личного кабинета"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        <label>
          apiUrl
          <input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://XXXX.api.green-api.com"
          />
        </label>

        <p className="hint">
          Данные возьмите в{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            console.green-api.com
          </a>
          . Для HTTP API очистите webhookUrl у инстанса.
        </p>

        <button type="submit" className="btn-primary">
          Войти
        </button>
      </form>
    </div>
  )
}
