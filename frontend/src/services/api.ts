import axios from 'axios'
import type { TokenResponse, User, Chat, Message, PaginatedMessages, ChatMember } from '../types'

const api = axios.create({ baseURL: '/api/v1' })

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post<TokenResponse>('/api/v1/auth/refresh', { refresh_token: refresh })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  registerTenant: (data: { name: string; slug: string; domain?: string }) =>
    api.post('/auth/register-tenant', data).then((r) => r.data),

  register: (data: { email: string; username: string; password: string; display_name?: string; tenant_slug: string }) =>
    api.post<TokenResponse>('/auth/register', data).then((r) => r.data),

  login: (data: { email: string; password: string; tenant_slug: string }) =>
    api.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  logout: (refresh_token: string) =>
    api.post('/auth/logout', { refresh_token }),
}

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  getMe: () => api.get<User>('/users/me').then((r) => r.data),

  updateMe: (data: { display_name?: string; bio?: string; avatar_url?: string }) =>
    api.patch<User>('/users/me', data).then((r) => r.data),

  uploadAvatar: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ avatar_url: string }>('/users/me/avatar', fd).then((r) => r.data)
  },

  list: () => api.get<User[]>('/users').then((r) => r.data),

  getById: (id: string) => api.get<User>(`/users/${id}`).then((r) => r.data),
}

// ─── Chats ────────────────────────────────────────────────────────────────────
export const chatsApi = {
  list: (params?: { chat_type?: string; topic?: string }) =>
    api.get<Chat[]>('/chats', { params }).then((r) => r.data),

  create: (data: { name?: string; description?: string; chat_type: string; topic?: string; member_ids: string[] }) =>
    api.post<Chat>('/chats', data).then((r) => r.data),

  getMembers: (chatId: string) =>
    api.get<ChatMember[]>(`/chats/${chatId}/members`).then((r) => r.data),

  addMember: (chatId: string, userId: string) =>
    api.post(`/chats/${chatId}/members/${userId}`).then((r) => r.data),

  removeMember: (chatId: string, userId: string) =>
    api.delete(`/chats/${chatId}/members/${userId}`).then((r) => r.data),

  markRead: (chatId: string) =>
    api.patch(`/chats/${chatId}/read`).then((r) => r.data),
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messagesApi = {
  list: (chatId: string, params?: { page?: number; per_page?: number }) =>
    api.get<PaginatedMessages>(`/chats/${chatId}/messages`, { params }).then((r) => r.data),

  send: (chatId: string, data: { content?: string; message_type?: string; reply_to_id?: string }) =>
    api.post<Message>(`/chats/${chatId}/messages`, data).then((r) => r.data),

  uploadFile: (chatId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<Message>(`/chats/${chatId}/messages/upload`, fd).then((r) => r.data)
  },

  edit: (chatId: string, messageId: string, content: string) =>
    api.patch<Message>(`/chats/${chatId}/messages/${messageId}`, { content }).then((r) => r.data),

  delete: (chatId: string, messageId: string) =>
    api.delete(`/chats/${chatId}/messages/${messageId}`).then((r) => r.data),

  react: (chatId: string, messageId: string, emoji: string) =>
    api.post(`/chats/${chatId}/messages/${messageId}/react`, null, { params: { emoji } }).then((r) => r.data),

  share: (chatId: string, messageId: string, targetChatId?: string) =>
    api.post(`/chats/${chatId}/messages/${messageId}/share`, null, {
      params: targetChatId ? { target_chat_id: targetChatId } : {}
    }).then((r) => r.data),
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
export const subscriptionsApi = {
  getPlans: () => api.get('/subscriptions/plans').then((r) => r.data),
  getMine: () => api.get('/subscriptions/me').then((r) => r.data),
  upgrade: (plan: string) => api.post('/subscriptions/upgrade', null, { params: { plan } }).then((r) => r.data),
}

export default api
