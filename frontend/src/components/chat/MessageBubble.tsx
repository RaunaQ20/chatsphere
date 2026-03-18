import { useState, useRef } from 'react'
import { Reply, Edit2, Trash2, Share2, MoreHorizontal, Check, CheckCheck, Download } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import clsx from 'clsx'
import type { Message } from '../../types'
import { messagesApi } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import { UserAvatar } from '../shared/UserAvatar'
import toast from 'react-hot-toast'
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react'

interface Props {
  message: Message
  isOwn: boolean
  showAvatar: boolean
  chatId: string
  onReply: () => void
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export function MessageBubble({ message, isOwn, showAvatar, chatId, onReply }: Props) {
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content || '')
  const [showShareModal, setShowShareModal] = useState(false)
  const { user } = useAuthStore()
  const { updateMessage, removeMessage, updateReaction, chats } = useChatStore()
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>()

  if (message.is_deleted) {
    return (
      <div className={clsx('flex items-center gap-2 px-2 py-0.5', isOwn ? 'justify-end' : 'justify-start')}>
        <span className="text-xs text-surface-600 italic px-3 py-1.5 rounded-xl bg-surface-900 border border-surface-800">
          🚫 Message deleted
        </span>
      </div>
    )
  }

  const handleReact = async (emoji: string) => {
    try {
      const result = await messagesApi.react(chatId, message.id, emoji)
      updateReaction(chatId, message.id, emoji, user!.id, result.action)
    } catch {
      toast.error('Failed to react')
    }
    setShowEmojiPicker(false)
  }

  const handleEdit = async () => {
    if (!editContent.trim()) return
    try {
      await messagesApi.edit(chatId, message.id, editContent.trim())
      updateMessage(chatId, message.id, { content: editContent.trim(), is_edited: true })
      setEditing(false)
      toast.success('Message edited')
    } catch {
      toast.error('Failed to edit message')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this message?')) return
    try {
      await messagesApi.delete(chatId, message.id)
      removeMessage(chatId, message.id)
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleShare = async (targetChatId?: string) => {
    try {
      const result = await messagesApi.share(chatId, message.id, targetChatId)
      toast.success(targetChatId ? 'Message forwarded!' : `Share link copied`)
      if (!targetChatId && result.share_link) {
        navigator.clipboard.writeText(`${window.location.origin}/share/${result.share_link}`)
      }
    } catch {
      toast.error('Failed to share')
    }
    setShowShareModal(false)
  }

  const timeStr = formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
  const fullTime = format(new Date(message.created_at), 'MMM d, yyyy h:mm a')

  return (
    <div
      className={clsx('group flex gap-2.5 px-2 py-0.5 relative', isOwn ? 'flex-row-reverse' : 'flex-row')}
      onMouseEnter={() => { hoverTimer.current = setTimeout(() => setShowActions(true), 100) }}
      onMouseLeave={() => { clearTimeout(hoverTimer.current); setShowActions(false); setShowEmojiPicker(false) }}
    >
      {/* Avatar */}
      <div className="w-8 flex-shrink-0 flex items-end pb-1">
        {showAvatar && !isOwn && message.sender && (
          <UserAvatar
            user={message.sender as any}
            size={28}
            showOnline
          />
        )}
      </div>

      <div className={clsx('flex flex-col max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name + time */}
        {showAvatar && !isOwn && (
          <div className="flex items-baseline gap-2 mb-1 px-1">
            <span className="text-xs font-semibold text-surface-300">
              {message.sender?.display_name || message.sender?.username}
            </span>
            <span className="text-[10px] text-surface-600" title={fullTime}>{timeStr}</span>
          </div>
        )}

        {/* Reply preview */}
        {message.reply_to_id && (
          <div className={clsx('flex items-center gap-1.5 mb-1 px-3 py-1 rounded-lg border-l-2 border-brand-500/50 bg-surface-800/50 text-xs text-surface-500 max-w-full', isOwn ? 'self-end' : 'self-start')}>
            <Reply size={10} />
            <span className="truncate">Replying to a message</span>
          </div>
        )}

        {/* Message content */}
        <div className="relative">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="input text-sm resize-none min-w-[200px]"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit() }
                  if (e.key === 'Escape') setEditing(false)
                }}
                rows={2}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(false)} className="btn-ghost text-xs px-2 py-1">Cancel</button>
                <button onClick={handleEdit} className="btn-primary text-xs px-2 py-1">Save</button>
              </div>
            </div>
          ) : (
            <>
              {/* File / Image */}
              {message.message_type === 'image' && message.file_url && (
                <div className="mb-1.5 rounded-xl overflow-hidden border border-surface-700">
                  <img
                    src={message.file_url}
                    alt={message.file_name || 'Image'}
                    className="max-w-[300px] max-h-[300px] object-cover block"
                  />
                </div>
              )}
              {message.message_type === 'file' && message.file_url && (
                <a
                  href={message.file_url}
                  download={message.file_name}
                  className={clsx('flex items-center gap-3 px-4 py-3 rounded-2xl border mb-1', isOwn ? 'bg-brand-700 border-brand-600 text-white' : 'bg-surface-800 border-surface-700 text-surface-200')}
                >
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', isOwn ? 'bg-brand-600' : 'bg-surface-700')}>
                    <Download size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{message.file_name || 'File'}</p>
                    {message.file_size && (
                      <p className={clsx('text-xs', isOwn ? 'text-brand-200' : 'text-surface-500')}>
                        {(message.file_size / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                </a>
              )}

              {/* Text content */}
              {message.content && (
                <div className={clsx('message-bubble', isOwn ? 'own' : 'other')}>
                  <p className="break-words whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
              )}

              {/* Edited indicator + timestamp for own */}
              <div className={clsx('flex items-center gap-1.5 mt-0.5 px-1', isOwn ? 'justify-end' : 'justify-start')}>
                {message.is_edited && <span className="text-[10px] text-surface-600 italic">edited</span>}
                {isOwn && <span className="text-[10px] text-surface-600" title={fullTime}>{timeStr}</span>}
                {isOwn && <CheckCheck size={11} className="text-brand-400" />}
              </div>
            </>
          )}
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {message.reactions.map((r) => {
              const userReacted = r.users.includes(user?.id || '')
              return (
                <button
                  key={r.emoji}
                  onClick={() => handleReact(r.emoji)}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all',
                    userReacted
                      ? 'bg-brand-600/20 border-brand-600/40 text-brand-300'
                      : 'bg-surface-800 border-surface-700 text-surface-400 hover:bg-surface-700'
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="font-medium">{r.count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Action toolbar */}
      {showActions && !editing && (
        <div className={clsx(
          'absolute top-0 flex items-center gap-0.5 bg-surface-800 border border-surface-700 rounded-xl shadow-lg px-1.5 py-1 z-10',
          isOwn ? 'right-12 -top-1' : 'left-12 -top-1'
        )}>
          {/* Quick emoji reactions */}
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-700 text-sm transition-colors"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          <div className="w-px h-4 bg-surface-700 mx-0.5" />

          {/* More emoji */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
              title="More reactions"
            >
              <span className="text-sm">+</span>
            </button>
            {showEmojiPicker && (
              <div className={clsx('absolute z-50 top-8', isOwn ? 'right-0' : 'left-0')}>
                <EmojiPicker
                  theme={Theme.DARK}
                  onEmojiClick={(data: EmojiClickData) => handleReact(data.emoji)}
                  height={350}
                  width={300}
                  searchDisabled={false}
                />
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-surface-700 mx-0.5" />

          <button onClick={onReply} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors" title="Reply">
            <Reply size={13} />
          </button>
          <button onClick={() => setShowShareModal(true)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors" title="Share">
            <Share2 size={13} />
          </button>
          {isOwn && (
            <>
              <button onClick={() => { setEditing(true); setShowActions(false) }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors" title="Edit">
                <Edit2 size={13} />
              </button>
              <button onClick={handleDelete} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-600/20 text-surface-400 hover:text-red-400 transition-colors" title="Delete">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Share modal */}
      {showShareModal && (
        <ShareModal
          chats={chats.filter((c) => c.id !== chatId)}
          onShare={handleShare}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  )
}

function ShareModal({ chats, onShare, onClose }: { chats: any[]; onShare: (id?: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card p-5 w-80 shadow-2xl animate-slide-up">
        <h3 className="font-semibold text-surface-100 mb-3">Share Message</h3>
        <button onClick={() => onShare()} className="w-full btn-ghost justify-start mb-2 text-sm">
          🔗 Copy share link
        </button>
        {chats.length > 0 && (
          <>
            <p className="text-xs text-surface-500 mb-2">Forward to...</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {chats.map((c) => (
                <button key={c.id} onClick={() => onShare(c.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-800 text-left">
                  <span className="text-sm text-surface-200 truncate">{c.name || 'Chat'}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <button onClick={onClose} className="btn-ghost w-full justify-center mt-3 text-sm">Cancel</button>
      </div>
    </div>
  )
}
