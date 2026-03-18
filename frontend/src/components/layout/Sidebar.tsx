import { useState, useEffect } from 'react'
import { MessageSquare, Users, Hash, Plus, Search, Settings, Crown, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import { usersApi } from '../../services/api'
import type { Chat, User } from '../../types'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import { NewChatModal } from './NewChatModal'
import { UserAvatar } from '../shared/UserAvatar'

interface SidebarProps {
  onOpenSettings: () => void
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const { chats, activeChatId, setActiveChat, fetchChats, loadingChats, onlineUsers } = useChatStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'direct' | 'group' | 'topic'>('all')
  const [showNewChat, setShowNewChat] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])

  useEffect(() => {
    fetchChats()
    usersApi.list().then(setAllUsers).catch(() => {})
  }, [])

  const filtered = chats.filter((c) => {
    const matchSearch = !search || (c.name || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.chat_type === filter
    return matchSearch && matchFilter
  })

  const totalUnread = chats.reduce((s, c) => s + (c.unread_count || 0), 0)

  return (
    <>
      <aside className="w-[var(--sidebar-width)] h-screen flex flex-col bg-surface-900 border-r border-surface-800">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-surface-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
                <MessageSquare size={14} className="text-white" />
              </div>
              <span className="font-semibold text-surface-100 text-sm">ChatSphere</span>
            </div>
            <button onClick={() => setShowNewChat(true)} className="w-7 h-7 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 flex items-center justify-center transition-colors" title="New chat">
              <Plus size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
            <input className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-surface-200 placeholder-surface-600 focus:outline-none focus:border-brand-600/50" placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-surface-800">
          {(['all', 'direct', 'group', 'topic'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={clsx('flex-1 py-1 rounded-md text-xs font-medium transition-colors capitalize', filter === f ? 'bg-brand-600/20 text-brand-300' : 'text-surface-500 hover:text-surface-300')}>
              {f === 'all' ? 'All' : f === 'direct' ? 'DMs' : f === 'group' ? 'Groups' : 'Topics'}
            </button>
          ))}
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {loadingChats ? (
            <div className="space-y-2 px-2 py-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="w-9 h-9 rounded-full bg-surface-800 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-surface-800 rounded animate-pulse w-2/3" />
                    <div className="h-2.5 bg-surface-800 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-surface-600 text-xs">
              {search ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            filtered.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === activeChatId}
                onClick={() => setActiveChat(chat.id)}
                currentUserId={user?.id}
                onlineUsers={onlineUsers}
              />
            ))
          )}
        </div>

        {/* User profile footer */}
        <div className="border-t border-surface-800 p-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <UserAvatar user={user!} size={32} />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-surface-900 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-100 truncate">{user?.display_name || user?.username}</p>
              <div className="flex items-center gap-1">
                {user?.subscription_plan !== 'free' && <Crown size={9} className="text-yellow-500" />}
                <p className="text-xs text-surface-500 capitalize">{user?.subscription_plan}</p>
              </div>
            </div>
            <button onClick={onOpenSettings} className="w-7 h-7 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-300 flex items-center justify-center transition-colors">
              <Settings size={14} />
            </button>
          </div>
        </div>
      </aside>

      {showNewChat && (
        <NewChatModal
          users={allUsers.filter((u) => u.id !== user?.id)}
          onClose={() => setShowNewChat(false)}
          onCreated={(chat) => {
            fetchChats()
            setActiveChat(chat.id)
            setShowNewChat(false)
          }}
        />
      )}
    </>
  )
}

interface ChatItemProps {
  chat: Chat
  isActive: boolean
  onClick: () => void
  currentUserId?: string
  onlineUsers: Set<string>
}

function ChatItem({ chat, isActive, onClick, onlineUsers }: ChatItemProps) {
  const icon = chat.chat_type === 'group' ? <Users size={14} /> : chat.chat_type === 'topic' ? <Hash size={14} /> : null

  return (
    <button onClick={onClick} className={clsx('w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-all', isActive ? 'bg-brand-600/15 border border-brand-600/20' : 'hover:bg-surface-800/60 border border-transparent')}>
      {/* Avatar / Icon */}
      <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold', isActive ? 'bg-brand-600 text-white' : 'bg-surface-700 text-surface-400')}>
        {icon || (chat.name || 'C').charAt(0).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={clsx('text-sm truncate font-medium', isActive ? 'text-brand-100' : 'text-surface-200')}>
            {chat.name || 'Chat'}
          </span>
          {chat.last_message && (
            <span className="text-[10px] text-surface-600 flex-shrink-0">
              {formatDistanceToNow(new Date(chat.last_message.created_at), { addSuffix: false })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs text-surface-500 truncate">
            {chat.last_message
              ? chat.last_message.message_type !== 'text'
                ? `📎 ${chat.last_message.message_type}`
                : chat.last_message.content
              : 'No messages yet'}
          </span>
          {(chat.unread_count || 0) > 0 && (
            <span className="badge bg-brand-600 text-white min-w-[18px] text-[10px]">
              {chat.unread_count! > 99 ? '99+' : chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
