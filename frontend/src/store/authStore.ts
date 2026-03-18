import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { wsService } from '../services/websocket'

interface AuthState {
  user: User | null
  tenantSlug: string
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string, tenantSlug: string) => void
  updateUser: (user: Partial<User>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenantSlug: '',
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken, tenantSlug) => {
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', refreshToken)
        set({ user, accessToken, refreshToken, tenantSlug, isAuthenticated: true })
        wsService.connect(accessToken)
      },

      updateUser: (partial) => {
        const current = get().user
        if (current) set({ user: { ...current, ...partial } })
      },

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        wsService.disconnect()
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, tenantSlug: '' })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        tenantSlug: state.tenantSlug,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
