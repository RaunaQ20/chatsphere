export type SubscriptionPlan = 'free' | 'pro' | 'enterprise'
export type ChatType = 'direct' | 'group' | 'topic'
export type MemberRole = 'owner' | 'admin' | 'member'
export type MessageType = 'text' | 'image' | 'file' | 'system'

export interface Tenant {
  id: string
  name: string
  slug: string
  domain?: string
  logo_url?: string
  is_active: boolean
  created_at: string
}

export interface User {
  id: string
  email: string
  username: string
  display_name?: string
  avatar_url?: string
  bio?: string
  is_online: boolean
  last_seen?: string
  subscription_plan: SubscriptionPlan
  tenant_id: string
  created_at: string
}

export interface ChatMember {
  id: string
  user: User
  role: MemberRole
  joined_at: string
  is_muted: boolean
}

export interface LastMessage {
  id: string
  content?: string
  message_type: MessageType
  created_at: string
  sender_id?: string
}

export interface Chat {
  id: string
  name?: string
  description?: string
  chat_type: ChatType
  topic?: string
  avatar_url?: string
  is_archived: boolean
  created_at: string
  member_count?: number
  last_message?: LastMessage
  unread_count?: number
}

export interface Reaction {
  emoji: string
  count: number
  users: string[]
}

export interface Message {
  id: string
  chat_id: string
  sender?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
    is_online: boolean
  }
  content?: string
  message_type: MessageType
  file_url?: string
  file_name?: string
  file_size?: number
  reply_to_id?: string
  is_edited: boolean
  is_deleted: boolean
  reactions: Reaction[]
  created_at: string
  updated_at?: string
}

export interface PaginatedMessages {
  items: Message[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface SubscriptionPlanInfo {
  id: SubscriptionPlan
  name: string
  price: number
  features: string[]
  limits: { max_users: number; max_chats: number; file_size_mb: number }
}

// WebSocket event types
export type WSEventType =
  | 'new_message'
  | 'message_edited'
  | 'message_deleted'
  | 'reaction_updated'
  | 'typing_indicator'
  | 'user_online'
  | 'user_offline'
  | 'chat_created'
  | 'pong'

export interface WSEvent {
  type: WSEventType
  payload: any
}
