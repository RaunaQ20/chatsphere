import { useEffect, useRef, useState, useCallback } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { ChatHeader } from './ChatHeader'
import { Loader2 } from 'lucide-react'
import type { Message } from '../../types'

export function ChatWindow() {
  const { activeChatId, messages, hasMore, fetchMessages, loadingMessages, typingUsers, chats } = useChatStore()
  const { user } = useAuthStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const isFirstLoad = useRef(true)

  const chatMessages = activeChatId ? messages[activeChatId] || [] : []
  const chat = chats.find((c) => c.id === activeChatId)
  const typingList = activeChatId ? typingUsers[activeChatId] || [] : []

  useEffect(() => {
    if (!activeChatId) return
    isFirstLoad.current = true
    setPage(1)
    fetchMessages(activeChatId, 1)
  }, [activeChatId])

  // Scroll to bottom on new messages (only if near bottom)
  useEffect(() => {
    if (!bottomRef.current || !scrollRef.current) return
    const el = scrollRef.current
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200

    if (isFirstLoad.current || nearBottom) {
      bottomRef.current.scrollIntoView({ behavior: isFirstLoad.current ? 'instant' : 'smooth' })
      isFirstLoad.current = false
    }
  }, [chatMessages.length])

  const loadMore = useCallback(async () => {
    if (!activeChatId || !hasMore[activeChatId] || loadingMessages) return
    const el = scrollRef.current
    const prevScrollHeight = el?.scrollHeight || 0
    const nextPage = page + 1
    setPage(nextPage)
    await fetchMessages(activeChatId, nextPage)
    // Maintain scroll position
    if (el) {
      const added = el.scrollHeight - prevScrollHeight
      el.scrollTop += added
    }
  }, [activeChatId, hasMore, loadingMessages, page])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop < 100) loadMore()
  }, [loadMore])

  if (!activeChatId || !chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-950">
        <div className="text-center">
          <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💬</span>
          </div>
          <h3 className="text-surface-300 font-medium mb-1">Select a conversation</h3>
          <p className="text-surface-600 text-sm">Choose a chat from the sidebar to start messaging</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-surface-950 min-w-0">
      <ChatHeader chat={chat} />

      {/* Messages area */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {/* Load more indicator */}
        {loadingMessages && (
          <div className="flex justify-center py-3">
            <Loader2 size={16} className="text-surface-500 animate-spin" />
          </div>
        )}

        {chatMessages.map((msg, idx) => {
          const prev = chatMessages[idx - 1]
          const showAvatar = !prev || prev.sender?.id !== msg.sender?.id
          const isOwn = msg.sender?.id === user?.id
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={isOwn}
              showAvatar={showAvatar}
              chatId={activeChatId}
              onReply={() => setReplyTo(msg)}
            />
          )
        })}

        {/* Typing indicator */}
        {typingList.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 bg-surface-500 rounded-full animate-pulse-dot" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <span className="text-xs text-surface-500">
              {typingList.length === 1 ? 'Someone is typing...' : `${typingList.length} people are typing...`}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <MessageInput chatId={activeChatId} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
    </div>
  )
}
