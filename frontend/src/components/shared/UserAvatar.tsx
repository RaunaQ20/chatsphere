import clsx from 'clsx'
import type { User } from '../../types'
import { useChatStore } from '../../store/chatStore'

interface Props {
  user: User | { id: string; username: string; display_name?: string; avatar_url?: string; is_online?: boolean }
  size?: number
  showOnline?: boolean
  className?: string
}

export function UserAvatar({ user, size = 36, showOnline = false, className }: Props) {
  const { onlineUsers } = useChatStore()
  const isOnline = onlineUsers.has(user.id) || user.is_online

  const initials = ((user.display_name || user.username) || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const colors = [
    'bg-brand-700', 'bg-purple-700', 'bg-teal-700',
    'bg-orange-700', 'bg-rose-700', 'bg-cyan-700',
  ]
  const colorIdx = user.id.charCodeAt(0) % colors.length

  return (
    <div className={clsx('relative flex-shrink-0', className)} style={{ width: size, height: size }}>
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.display_name || user.username}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div className={clsx('w-full h-full rounded-full flex items-center justify-center text-white font-semibold', colors[colorIdx])} style={{ fontSize: size * 0.35 }}>
          {initials}
        </div>
      )}
      {showOnline && (
        <div className={clsx('absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface-900', isOnline ? 'bg-green-500' : 'bg-surface-600')} style={{ width: size * 0.3, height: size * 0.3 }} />
      )}
    </div>
  )
}
