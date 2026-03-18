import { useState, useEffect } from 'react'
import { Sidebar } from '../components/layout/Sidebar'
import { ChatWindow } from '../components/chat/ChatWindow'
import { SettingsModal } from '../components/layout/SettingsModal'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuthStore } from '../store/authStore'
import { wsService } from '../services/websocket'

export function ChatLayout() {
  const [showSettings, setShowSettings] = useState(false)
  const { accessToken } = useAuthStore()

  // Connect WebSocket on mount
  useEffect(() => {
    if (accessToken) wsService.connect(accessToken)
    return () => {} // Don't disconnect on unmount - handled by store
  }, [accessToken])

  // Register global WS event handlers
  useWebSocket()

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      <Sidebar onOpenSettings={() => setShowSettings(true)} />
      <main className="flex-1 flex min-w-0">
        <ChatWindow />
      </main>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
