export interface Credentials {
  idInstance: string
  apiTokenInstance: string
  apiUrl: string
}

export interface ChatMessage {
  id: string
  chatId: string
  text: string
  timestamp: number
  direction: 'incoming' | 'outgoing'
  status?: 'sending' | 'sent' | 'failed'
}

export interface Chat {
  id: string
  phone: string
  title: string
  lastMessage?: string
  updatedAt: number
}

export interface NotificationBody {
  typeWebhook: string
  timestamp: number
  idMessage: string
  senderData?: {
    chatId: string
    chatName?: string
    sender?: string
    senderName?: string
    senderPhoneNumber?: number | string
  }
  messageData?: {
    typeMessage: string
    textMessageData?: {
      textMessage: string
    }
    extendedTextMessageData?: {
      text: string
    }
  }
}

export interface ReceiveNotificationResponse {
  receiptId: number
  body: NotificationBody
}
