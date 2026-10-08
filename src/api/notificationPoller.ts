import { deleteNotification, receiveNotification } from './greenApi'
import type { Credentials, NotificationBody } from '../types'

type Handler = (body: NotificationBody) => void
type ErrorHandler = (error: Error) => void
type StatusHandler = (status: 'idle' | 'listening' | 'error') => void

class NotificationPoller {
  private running = false
  private abort: AbortController | null = null
  private credentials: Credentials | null = null
  private onNotification: Handler | null = null
  private onError: ErrorHandler | null = null
  private onStatus: StatusHandler | null = null
  private loopId = 0

  setHandlers(handlers: {
    onNotification: Handler
    onError?: ErrorHandler
    onStatus?: StatusHandler
  }) {
    this.onNotification = handlers.onNotification
    this.onError = handlers.onError ?? null
    this.onStatus = handlers.onStatus ?? null
  }

  start(credentials: Credentials) {
    const same =
      this.credentials?.idInstance === credentials.idInstance &&
      this.credentials?.apiTokenInstance === credentials.apiTokenInstance &&
      this.credentials?.apiUrl === credentials.apiUrl &&
      this.running

    this.credentials = credentials
    if (same) return

    this.stopLoop()
    this.running = true
    this.abort = new AbortController()
    this.onStatus?.('listening')
    const id = ++this.loopId
    void this.loop(id)
  }

  stop() {
    this.running = false
    this.credentials = null
    this.stopLoop()
    this.onStatus?.('idle')
  }

  private stopLoop() {
    this.abort?.abort()
    this.abort = null
    this.loopId += 1
  }

  private async loop(id: number) {
    while (this.running && id === this.loopId) {
      const creds = this.credentials
      const signal = this.abort?.signal
      if (!creds || !signal) break

      try {
        const notification = await receiveNotification(creds, 5, signal)
        if (!this.running || id !== this.loopId) return

        this.onStatus?.('listening')

        if (!notification) continue

        try {
          if (notification.body) {
            this.onNotification?.(notification.body)
          }
        } catch {
          void 0
        }

        try {
          await deleteNotification(creds, notification.receiptId)
        } catch {
          void 0
        }
      } catch (err) {
        if (!this.running || id !== this.loopId) return
        const error = err instanceof Error ? err : new Error(String(err))
        if (error.name === 'AbortError') return

        this.onStatus?.('error')
        this.onError?.(error)
        await sleep(2500)
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export const notificationPoller = new NotificationPoller()
