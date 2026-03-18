import type { WSEvent } from '../types'

type EventHandler = (payload: any) => void

class WebSocketService {
  private ws: WebSocket | null = null
  private handlers: Map<string, Set<EventHandler>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private isIntentionalClose = false

  connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.isIntentionalClose = false

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    this.ws = new WebSocket(`${protocol}//${host}/ws?token=${token}`)

    this.ws.onopen = () => {
      console.log('[WS] Connected')
      this.startPing()
    }

    this.ws.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data)
        this.emit(data.type, data.payload)
      } catch (e) {
        console.error('[WS] Parse error', e)
      }
    }

    this.ws.onclose = () => {
      this.stopPing()
      if (!this.isIntentionalClose) {
        console.log('[WS] Disconnected — reconnecting in 3s...')
        this.reconnectTimer = setTimeout(() => {
          const t = localStorage.getItem('access_token')
          if (t) this.connect(t)
        }, 3000)
      }
    }

    this.ws.onerror = (e) => console.error('[WS] Error', e)
  }

  disconnect() {
    this.isIntentionalClose = true
    this.stopPing()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  send(type: string, payload: any = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }))
    }
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: EventHandler) {
    this.handlers.get(event)?.delete(handler)
  }

  private emit(event: string, payload: any) {
    this.handlers.get(event)?.forEach((h) => h(payload))
  }

  private startPing() {
    this.pingInterval = setInterval(() => this.send('ping'), 25000)
  }

  private stopPing() {
    if (this.pingInterval) clearInterval(this.pingInterval)
  }

  sendTyping(chatId: string, isTyping: boolean) {
    this.send('typing', { chat_id: chatId, is_typing: isTyping })
  }

  joinChat(chatId: string) {
    this.send('join_chat', { chat_id: chatId })
  }
}

export const wsService = new WebSocketService()
