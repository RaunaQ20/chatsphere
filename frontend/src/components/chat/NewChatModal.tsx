import { useState } from 'react'
import { X, Users, Hash, MessageSquare, Search, Check, Loader2 } from 'lucide-react'
import { chatsApi } from '../../services/api'
import type { Chat, User, ChatType } from '../../types'
import { UserAvatar } from '../shared/UserAvatar'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  users: User[]
  onClose: () => void
  onCreated: (chat: Chat) => void
}

export function NewChatModal({ users, onClose, onCreated }: Props) {
  const [type, setType] = useState<ChatType>('direct')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = users.filter((u) =>
    (u.display_name || u.username).toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const toggleUser = (id: string) => {
    if (type === 'direct') {
      setSelectedUsers([id])
    } else {
      setSelectedUsers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
    }
  }

  const create = async () => {
    if (selectedUsers.length === 0) { toast.error('Select at least one user'); return }
    if (type !== 'direct' && !name) { toast.error('Enter a name'); return }
    setLoading(true)
    try {
      const chat = await chatsApi.create({
        chat_type: type,
        member_ids: selectedUsers,
        name: type !== 'direct' ? name : undefined,
        description: description || undefined,
        topic: type === 'topic' ? topic : undefined,
      })
      onCreated(chat)
      toast.success('Chat created!')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create chat')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-900 border border-surface-800 rounded-2xl w-full max-w-md shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <h2 className="font-semibold text-surface-100">New Conversation</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-surface-800 flex items-center justify-center text-surface-500 hover:text-surface-300">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'direct', label: 'Direct', icon: <MessageSquare size={14} /> },
              { value: 'group', label: 'Group', icon: <Users size={14} /> },
              { value: 'topic', label: 'Topic', icon: <Hash size={14} /> },
            ] as const).map((t) => (
              <button key={t.value} onClick={() => { setType(t.value); setSelectedUsers([]) }} className={clsx('flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all', type === t.value ? 'border-brand-600/50 bg-brand-600/15 text-brand-300' : 'border-surface-700 text-surface-500 hover:border-surface-600 hover:text-surface-300')}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Name / Topic fields for non-DM */}
          {type !== 'direct' && (
            <div className="space-y-3">
              <input className="input" placeholder={type === 'group' ? 'Group name' : 'Channel name'} value={name} onChange={(e) => setName(e.target.value)} />
              {type === 'topic' && (
                <input className="input" placeholder="Topic (e.g. #engineering)" value={topic} onChange={(e) => setTopic(e.target.value)} />
              )}
              <input className="input" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          )}

          {/* User search */}
          <div>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
              <input className="input pl-8 text-xs" placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {filtered.map((u) => {
                const selected = selectedUsers.includes(u.id)
                return (
                  <button key={u.id} onClick={() => toggleUser(u.id)} className={clsx('w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left', selected ? 'bg-brand-600/15' : 'hover:bg-surface-800')}>
                    <UserAvatar user={u} size={32} showOnline />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-200 truncate">{u.display_name || u.username}</p>
                      <p className="text-xs text-surface-500 truncate">{u.email}</p>
                    </div>
                    {selected && <Check size={14} className="text-brand-400 flex-shrink-0" />}
                  </button>
                )
              })}
              {filtered.length === 0 && <p className="text-xs text-surface-600 text-center py-4">No users found</p>}
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <p className="text-xs text-surface-500">{selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected</p>
          )}
        </div>

        <div className="px-5 pb-5">
          <button onClick={create} disabled={loading || selectedUsers.length === 0} className="btn-primary w-full justify-center">
            {loading ? <Loader2 size={15} className="animate-spin" /> : 'Create Conversation'}
          </button>
        </div>
      </div>
    </div>
  )
}
