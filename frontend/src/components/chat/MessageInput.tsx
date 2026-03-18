import { useState, useRef, useCallback } from 'react'
import { Send, Paperclip, Smile, X, Image, File as FileIcon, Loader2 } from 'lucide-react'
import { messagesApi } from '../../services/api'
import { useChatStore } from '../../store/chatStore'
import { useTypingIndicator } from '../../hooks/useTyping'
import type { Message } from '../../types'
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  chatId: string
  replyTo: Message | null
  onClearReply: () => void
}

export function MessageInput({ chatId, replyTo, onClearReply }: Props) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addMessage } = useChatStore()
  const { onType, stopTyping } = useTypingIndicator(chatId)

  const send = useCallback(async () => {
    const text = content.trim()
    if (!text || sending) return
    setSending(true)
    setContent('')
    stopTyping()
    try {
      await messagesApi.send(chatId, {
        content: text,
        message_type: 'text',
        reply_to_id: replyTo?.id,
      })
      onClearReply()
    } catch {
      toast.error('Failed to send message')
      setContent(text) // restore
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [content, sending, chatId, replyTo])

  const uploadFile = useCallback(async (file: File) => {
    const maxMB = 10
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`File too large (max ${maxMB}MB)`)
      return
    }
    setUploading(true)
    try {
      const msg = await messagesApi.uploadFile(chatId, file)
      addMessage(msg)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [chatId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    onType()
    // Auto-resize
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  const handleEmojiClick = (data: EmojiClickData) => {
    setContent((c) => c + data.emoji)
    setShowEmoji(false)
    textareaRef.current?.focus()
  }

  return (
    <div
      className={clsx('border-t border-surface-800 bg-surface-900 transition-colors', dragOver && 'bg-brand-600/5 border-brand-600/40')}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-0">
          <div className="flex-1 flex items-center gap-2 bg-surface-800 border-l-2 border-brand-500 rounded-r-lg px-3 py-1.5">
            <span className="text-xs text-brand-400 font-medium">Replying to</span>
            <span className="text-xs text-surface-400 truncate">
              {replyTo.content || '[attachment]'}
            </span>
          </div>
          <button onClick={onClearReply} className="text-surface-500 hover:text-surface-300 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div className="px-4 py-2 text-center text-sm text-brand-400 font-medium">
          📎 Drop file to upload
        </div>
      )}

      <div className="flex items-end gap-2 px-4 py-3">
        {/* Attach file */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="*/*"
            onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-all border border-surface-700 flex-shrink-0"
            title="Attach file"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
          </button>
        </div>

        {/* Input area */}
        <div className="flex-1 relative bg-surface-800 border border-surface-700 rounded-2xl focus-within:border-brand-500/50 focus-within:ring-1 focus-within:ring-brand-500/20 transition-all">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className="w-full bg-transparent px-4 py-2.5 text-sm text-surface-100 placeholder-surface-600 focus:outline-none resize-none max-h-40 leading-relaxed pr-10"
          />
          {/* Emoji button inside input */}
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowEmoji(!showEmoji)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-surface-500 hover:text-surface-300 transition-colors"
                title="Emoji"
              >
                <Smile size={15} />
              </button>
              {showEmoji && (
                <div className="absolute bottom-10 right-0 z-50">
                  <EmojiPicker
                    theme={Theme.DARK}
                    onEmojiClick={handleEmojiClick}
                    height={380}
                    width={320}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={send}
          disabled={!content.trim() || sending}
          className={clsx(
            'w-9 h-9 flex items-center justify-center rounded-xl transition-all flex-shrink-0',
            content.trim()
              ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-900/40'
              : 'bg-surface-800 text-surface-600 cursor-not-allowed border border-surface-700'
          )}
          title="Send (Enter)"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  )
}
