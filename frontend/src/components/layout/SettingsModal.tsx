import { useState, useRef } from 'react'
import { X, User, CreditCard, LogOut, Camera, Loader2, Check, Crown, Zap, Building2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { usersApi, subscriptionsApi, authApi } from '../../services/api'
import { UserAvatar } from '../shared/UserAvatar'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props { onClose: () => void }

type Tab = 'profile' | 'subscription'

export function SettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('profile')
  const { user, updateUser, logout, tenantSlug, refreshToken } = useAuthStore() as any
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const saveProfile = async () => {
    setSaving(true)
    try {
      const updated = await usersApi.updateMe({ display_name: displayName, bio })
      updateUser(updated)
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true)
    try {
      const { avatar_url } = await usersApi.uploadAvatar(file)
      updateUser({ avatar_url })
      toast.success('Avatar updated')
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const loadPlans = async () => {
    if (plans.length) return
    setLoadingPlans(true)
    try {
      const data = await subscriptionsApi.getPlans()
      setPlans(data.plans)
    } catch {
      toast.error('Failed to load plans')
    } finally {
      setLoadingPlans(false)
    }
  }

  const upgradePlan = async (planId: string) => {
    setUpgradingPlan(planId)
    try {
      await subscriptionsApi.upgrade(planId)
      updateUser({ subscription_plan: planId })
      toast.success(`Upgraded to ${planId} plan!`)
    } catch {
      toast.error('Failed to upgrade plan')
    } finally {
      setUpgradingPlan(null)
    }
  }

  const handleLogout = async () => {
    try {
      const rt = localStorage.getItem('refresh_token')
      if (rt) await authApi.logout(rt)
    } catch {}
    logout()
    onClose()
    toast.success('Logged out')
  }

  const planIcons: Record<string, React.ReactNode> = {
    free: <Zap size={16} className="text-surface-400" />,
    pro: <Crown size={16} className="text-yellow-400" />,
    enterprise: <Building2 size={16} className="text-purple-400" />,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-900 border border-surface-800 rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800">
          <h2 className="font-semibold text-surface-100">Settings</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-300">
            <X size={15} />
          </button>
        </div>

        <div className="flex">
          {/* Sidebar tabs */}
          <div className="w-44 border-r border-surface-800 p-3 space-y-1">
            {([
              { id: 'profile', label: 'Profile', icon: <User size={14} /> },
              { id: 'subscription', label: 'Subscription', icon: <CreditCard size={14} /> },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); if (t.id === 'subscription') loadPlans() }}
                className={clsx('sidebar-item w-full', tab === t.id && 'active')}
              >
                {t.icon}
                {t.label}
              </button>
            ))}

            <div className="pt-2 border-t border-surface-800 mt-2">
              <button onClick={handleLogout} className="sidebar-item w-full text-red-500 hover:bg-red-600/10 hover:text-red-400">
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            {tab === 'profile' && (
              <div className="space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                    <UserAvatar user={user!} size={64} />
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploadingAvatar ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
                  <div>
                    <p className="font-medium text-surface-100">{user?.display_name || user?.username}</p>
                    <p className="text-sm text-surface-500">{user?.email}</p>
                    <p className="text-xs text-surface-600 mt-0.5">@{user?.username} · {tenantSlug}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">Display Name</label>
                  <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your display name" maxLength={150} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">Bio</label>
                  <textarea className="input resize-none" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about yourself..." maxLength={500} />
                </div>

                <button onClick={saveProfile} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save Changes
                </button>
              </div>
            )}

            {tab === 'subscription' && (
              <div>
                <p className="text-sm text-surface-400 mb-4">
                  Current plan: <span className="font-semibold text-surface-100 capitalize">{user?.subscription_plan}</span>
                </p>

                {loadingPlans ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={20} className="text-surface-500 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {plans.map((plan) => {
                      const isCurrent = user?.subscription_plan === plan.id
                      const isUpgrade = ['free', 'pro', 'enterprise'].indexOf(plan.id) > ['free', 'pro', 'enterprise'].indexOf(user?.subscription_plan || 'free')

                      return (
                        <div key={plan.id} className={clsx('p-4 rounded-xl border transition-all', isCurrent ? 'border-brand-600/50 bg-brand-600/10' : 'border-surface-700 hover:border-surface-600')}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {planIcons[plan.id]}
                              <div>
                                <p className="font-semibold text-surface-100 capitalize">{plan.name}</p>
                                <p className="text-sm text-surface-400">
                                  {plan.price === 0 ? 'Free forever' : `$${plan.price}/month`}
                                </p>
                              </div>
                            </div>
                            {isCurrent ? (
                              <span className="badge bg-brand-600/20 text-brand-300 border border-brand-600/30 text-xs">Current</span>
                            ) : isUpgrade ? (
                              <button
                                onClick={() => upgradePlan(plan.id)}
                                disabled={upgradingPlan === plan.id}
                                className="btn-primary text-xs px-3 py-1.5"
                              >
                                {upgradingPlan === plan.id ? <Loader2 size={12} className="animate-spin" /> : 'Upgrade'}
                              </button>
                            ) : null}
                          </div>
                          <ul className="mt-3 space-y-1">
                            {plan.features.map((f: string) => (
                              <li key={f} className="flex items-center gap-2 text-xs text-surface-400">
                                <Check size={11} className="text-green-500 flex-shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
