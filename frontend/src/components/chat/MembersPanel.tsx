import { useEffect, useState } from 'react'
import { X, Crown, Shield, UserMinus, UserPlus, Loader2 } from 'lucide-react'
import { chatsApi, usersApi } from '../../services/api'
import type { ChatMember, User } from '../../types'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import { UserAvatar } from '../shared/UserAvatar'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  chatId: string
  onClose: () => void
}

export function MembersPanel({ chatId, onClose }: Props) {
  const [members, setMembers] = useState<ChatMember[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const { user } = useAuthStore()
  const { onlineUsers } = useChatStore()

  const currentMember = members.find((m) => m.user.id === user?.id)
  const isAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin'

  useEffect(() => {
    loadMembers()
    usersApi.list().then(setAllUsers).catch(() => {})
  }, [chatId])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const data = await chatsApi.getMembers(chatId)
      setMembers(data)
    } catch {
      toast.error('Failed to load members')
    } finally {
      setLoading(false)
    }
  }

  const removeMember = async (userId: string) => {
    if (!confirm('Remove this member?')) return
    try {
      await chatsApi.removeMember(chatId, userId)
      setMembers((prev) => prev.filter((m) => m.user.id !== userId))
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    }
  }

  const addMember = async (userId: string) => {
    try {
      await chatsApi.addMember(chatId, userId)
      await loadMembers()
      toast.success('Member added')
      setShowAddUser(false)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add member')
    }
  }

  const memberIds = new Set(members.map((m) => m.user.id))
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id))

  const roleIcon = (role: string) => {
    if (role === 'owner') return <Crown size={11} className="text-yellow-400" />
    if (role === 'admin') return <Shield size={11} className="text-blue-400" />
    return null
  }

  return (
    <div className="w-64 h-full border-l border-surface-800 bg-surface-900 flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <h3 className="font-semibold text-surface-100 text-sm">Members ({members.length})</h3>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-300">
          <X size={13} />
        </button>
      </div>

      {/* Add member button */}
      {isAdmin && (
        <div className="px-3 py-2 border-b border-surface-800">
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600/10 hover:bg-brand-600/20 text-brand-400 text-sm transition-colors"
          >
            <UserPlus size={13} />
            <span>Add member</span>
          </button>

          {showAddUser && availableUsers.length > 0 && (
            <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
              {availableUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => addMember(u.id)}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-800 text-left"
                >
                  <UserAvatar user={u} size={24} />
                  <span className="text-xs text-surface-300 truncate">{u.display_name || u.username}</span>
                </button>
              ))}
            </div>
          )}
          {showAddUser && availableUsers.length === 0 && (
            <p className="text-xs text-surface-600 text-center py-2 mt-2">All users are already members</p>
          )}
        </div>
      )}

      {/* Members list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={16} className="text-surface-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-0.5">
            {members.map((member) => {
              const isOnline = onlineUsers.has(member.user.id)
              const isSelf = member.user.id === user?.id
              return (
                <div key={member.id} className="group flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-surface-800/60">
                  <div className="relative flex-shrink-0">
                    <UserAvatar user={member.user} size={32} />
                    <div className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-900', isOnline ? 'bg-green-500' : 'bg-surface-600')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-surface-200 truncate">
                        {member.user.display_name || member.user.username}
                        {isSelf && <span className="text-surface-600"> (you)</span>}
                      </span>
                      {roleIcon(member.role)}
                    </div>
                    <p className="text-[10px] text-surface-600 capitalize">{member.role}</p>
                  </div>

                  {/* Remove button (admin only, not self, not other owner) */}
                  {isAdmin && !isSelf && member.role !== 'owner' && (
                    <button
                      onClick={() => removeMember(member.user.id)}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-600/20 text-surface-600 hover:text-red-400 transition-all"
                      title="Remove member"
                    >
                      <UserMinus size={11} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
