import { create } from 'zustand'
import type { Chat, Message } from '../types'
import { chatsApi, messagesApi } from '../services/api'

interface ChatState {
  chats: Chat[]
  activeChatId: string | null
  messages: Record<string, Message[]>
  hasMore: Record<string, boolean>
  typingUsers: Record<string, string[]>   // chatId -> userIds
  onlineUsers: Set<string>
  loadingChats: boolean
  loadingMessages: boolean

  setActiveChat: (chatId: string | null) => void
  fetchChats: () => Promise<void>
  fetchMessages: (chatId: string, page?: number) => Promise<void>
  addMessage: (msg: Message) => void
  updateMessage: (chatId: string, msgId: string, updates: Partial<Message>) => void
  removeMessage: (chatId: string, msgId: string) => void
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void
  setUserOnline: (userId: string, online: boolean) => void
  updateLastMessage: (chatId: string, msg: Message) => void
  incrementUnread: (chatId: string) => void
  clearUnread: (chatId: string) => void
  updateReaction: (chatId: string, msgId: string, emoji: string, userId: string, action: 'added' | 'removed') => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  hasMore: {},
  typingUsers: {},
  onlineUsers: new Set(),
  loadingChats: false,
  loadingMessages: false,

  setActiveChat: (chatId) => {
    set({ activeChatId: chatId })
    if (chatId) {
      chatsApi.markRead(chatId).catch(() => {})
      get().clearUnread(chatId)
    }
  },

  fetchChats: async () => {
    set({ loadingChats: true })
    try {
      const chats = await chatsApi.list()
      set({ chats, loadingChats: false })
    } catch {
      set({ loadingChats: false })
    }
  },

  fetchMessages: async (chatId, page = 1) => {
    set({ loadingMessages: true })
    try {
      const data = await messagesApi.list(chatId, { page, per_page: 50 })
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: page === 1 ? data.items : [...data.items, ...(state.messages[chatId] || [])],
        },
        hasMore: { ...state.hasMore, [chatId]: data.has_more },
        loadingMessages: false,
      }))
    } catch {
      set({ loadingMessages: false })
    }
  },

  addMessage: (msg) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [msg.chat_id]: [...(state.messages[msg.chat_id] || []), msg],
      },
    }))
    get().updateLastMessage(msg.chat_id, msg)
  },

  updateMessage: (chatId, msgId, updates) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === msgId ? { ...m, ...updates } : m
        ),
      },
    }))
  },

  removeMessage: (chatId, msgId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === msgId ? { ...m, is_deleted: true, content: undefined } : m
        ),
      },
    }))
  },

  setTyping: (chatId, userId, isTyping) => {
    set((state) => {
      const current = state.typingUsers[chatId] || []
      const updated = isTyping
        ? [...new Set([...current, userId])]
        : current.filter((id) => id !== userId)
      return { typingUsers: { ...state.typingUsers, [chatId]: updated } }
    })
  },

  setUserOnline: (userId, online) => {
    set((state) => {
      const next = new Set(state.onlineUsers)
      online ? next.add(userId) : next.delete(userId)
      return { onlineUsers: next }
    })
  },

  updateLastMessage: (chatId, msg) => {
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              last_message: {
                id: msg.id,
                content: msg.content,
                message_type: msg.message_type,
                created_at: msg.created_at,
                sender_id: msg.sender?.id,
              },
            }
          : c
      ),
    }))
  },

  incrementUnread: (chatId) => {
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c
      ),
    }))
  },

  clearUnread: (chatId) => {
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: 0 } : c
      ),
    }))
  },

  updateReaction: (chatId, msgId, emoji, userId, action) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) => {
          if (m.id !== msgId) return m
          let reactions = [...m.reactions]
          const idx = reactions.findIndex((r) => r.emoji === emoji)
          if (action === 'added') {
            if (idx >= 0) {
              reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, users: [...reactions[idx].users, userId] }
            } else {
              reactions.push({ emoji, count: 1, users: [userId] })
            }
          } else {
            if (idx >= 0) {
              const updated = { ...reactions[idx], count: reactions[idx].count - 1, users: reactions[idx].users.filter((u) => u !== userId) }
              reactions = updated.count > 0 ? reactions.map((r, i) => (i === idx ? updated : r)) : reactions.filter((_, i) => i !== idx)
            }
          }
          return { ...m, reactions }
        }),
      },
    }))
  },
}))
