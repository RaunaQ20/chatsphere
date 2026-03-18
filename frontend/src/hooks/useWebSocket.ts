import { useEffect } from 'react'
import { wsService } from '../services/websocket'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import type { Message } from '../types'

export function useWebSocket() {
  const { addMessage, updateMessage, removeMessage, setTyping, setUserOnline, incrementUnread, updateReaction, activeChatId } = useChatStore()
  const { user } = useAuthStore()

  useEffect(() => {
    const offNewMessage = wsService.on('new_message', (payload: Message) => {
      addMessage(payload)
      // Increment unread if not in active chat
      if (payload.chat_id !== activeChatId && payload.sender?.id !== user?.id) {
        incrementUnread(payload.chat_id)
      }
    })

    const offEdited = wsService.on('message_edited', (payload: { message_id: string; content: string; chat_id: string }) => {
      updateMessage(payload.chat_id, payload.message_id, { content: payload.content, is_edited: true })
    })

    const offDeleted = wsService.on('message_deleted', (payload: { message_id: string; chat_id: string }) => {
      removeMessage(payload.chat_id, payload.message_id)
    })

    const offTyping = wsService.on('typing_indicator', (payload: { chat_id: string; user_id: string; is_typing: boolean }) => {
      if (payload.user_id !== user?.id) {
        setTyping(payload.chat_id, payload.user_id, payload.is_typing)
      }
    })

    const offOnline = wsService.on('user_online', (payload: { user_id: string }) => {
      setUserOnline(payload.user_id, true)
    })

    const offOffline = wsService.on('user_offline', (payload: { user_id: string }) => {
      setUserOnline(payload.user_id, false)
    })

    const offReaction = wsService.on('reaction_updated', (payload: { chat_id: string; message_id: string; emoji: string; user_id: string; action: 'added' | 'removed' }) => {
      updateReaction(payload.chat_id, payload.message_id, payload.emoji, payload.user_id, payload.action)
    })

    return () => {
      offNewMessage()
      offEdited()
      offDeleted()
      offTyping()
      offOnline()
      offOffline()
      offReaction()
    }
  }, [activeChatId, user?.id])
}
