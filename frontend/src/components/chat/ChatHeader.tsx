import { useState } from 'react'
import { Users, Hash, Phone, Video, MoreHorizontal, Info, Search } from 'lucide-react'
import type { Chat } from '../../types'
import { MembersPanel } from './MembersPanel'
import clsx from 'clsx'

interface Props { chat: Chat }

export function ChatHeader({ chat }: Props) {
  const [showMembers, setShowMembers] = useState(false)

  const icon = chat.chat_type === 'group'
    ? <Users size={15} className="text-brand-400" />
    : chat.chat_type === 'topic'
    ? <Hash size={15} className="text-purple-400" />
    : null

  const label = chat.chat_type === 'topic' && chat.topic ? `#${chat.topic}` : chat.name || 'Direct Message'

  return (
    <>
      <header className="h-[var(--header-height)] flex items-center justify-between px-4 border-b border-surface-800 bg-surface-900 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-semibold text-surface-100 text-sm truncate">{label}</h2>
            {chat.description && <p className="text-xs text-surface-500 truncate">{chat.description}</p>}
            {chat.member_count && <p className="text-xs text-surface-600">{chat.member_count} members</p>}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button className="btn-ghost p-2 rounded-lg" title="Search in chat">
            <Search size={15} />
          </button>
          {chat.chat_type !== 'direct' && (
            <button onClick={() => setShowMembers(!showMembers)} className={clsx('btn-ghost p-2 rounded-lg', showMembers && 'bg-surface-800 text-surface-100')} title="Members">
              <Users size={15} />
            </button>
          )}
          <button className="btn-ghost p-2 rounded-lg" title="More options">
            <MoreHorizontal size={15} />
          </button>
        </div>
      </header>

      {showMembers && <MembersPanel chatId={chat.id} onClose={() => setShowMembers(false)} />}
    </>
  )
}
