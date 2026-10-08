import { useEffect, useState } from 'react'
import { notificationPoller } from '../api/notificationPoller'
import type { Credentials, NotificationBody } from '../types'

interface Options {
  credentials: Credentials | null
  enabled: boolean
  onNotification: (body: NotificationBody) => void
  onError?: (error: Error) => void
}

export type PollStatus = 'idle' | 'listening' | 'error'

export function useNotificationPolling({
  credentials,
  enabled,
  onNotification,
  onError,
}: Options): PollStatus {
  const [status, setStatus] = useState<PollStatus>('idle')

  useEffect(() => {
    notificationPoller.setHandlers({
      onNotification,
      onError,
      onStatus: setStatus,
    })
  }, [onNotification, onError])

  useEffect(() => {
    if (!enabled || !credentials) {
      notificationPoller.stop()
      setStatus('idle')
      return
    }

    notificationPoller.start(credentials)
  }, [enabled, credentials?.idInstance, credentials?.apiTokenInstance, credentials?.apiUrl])

  return status
}
