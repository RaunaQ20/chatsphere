import { useRef, useCallback } from 'react'
import { wsService } from '../services/websocket'

export function useTypingIndicator(chatId: string) {
  const typingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const onType = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true
      wsService.sendTyping(chatId, true)
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      typingRef.current = false
      wsService.sendTyping(chatId, false)
    }, 2500)
  }, [chatId])

  const stopTyping = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (typingRef.current) {
      typingRef.current = false
      wsService.sendTyping(chatId, false)
    }
  }, [chatId])

  return { onType, stopTyping }
}
