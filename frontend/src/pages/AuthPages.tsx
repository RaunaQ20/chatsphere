import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { MessageSquare, ArrowRight, Eye, EyeOff, Building2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import clsx from 'clsx'

export function LoginPage() {
  const navigate = useNavigate()
  const { setAuth, isAuthenticated } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '', tenant_slug: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (isAuthenticated) navigate('/') }, [isAuthenticated])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.tenant_slug) { toast.error('Enter your organization slug'); return }
    setLoading(true)
    try {
      const data = await authApi.login(form)
      setAuth(data.user, data.access_token, data.refresh_token, form.tenant_slug)
      navigate('/')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to ChatSphere"
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-surface-400 mb-1.5">Organization</label>
          <div className="relative">
            <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              className="input pl-9"
              placeholder="your-org-slug"
              value={form.tenant_slug}
              onChange={(e) => setForm({ ...form, tenant_slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-400 mb-1.5">Email</label>
          <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-400 mb-1.5">Password</label>
          <div className="relative">
            <input className="input pr-10" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Sign In</span><ArrowRight size={15} /></>}
        </button>
      </form>
      <p className="text-center text-sm text-surface-500 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">Create one</Link>
      </p>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [step, setStep] = useState<'org' | 'user'>('org')
  const [orgForm, setOrgForm] = useState({ name: '', slug: '' })
  const [userForm, setUserForm] = useState({ email: '', username: '', password: '', display_name: '' })
  const [loading, setLoading] = useState(false)
  const [tenantCreated, setTenantCreated] = useState(false)

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.registerTenant(orgForm)
      setTenantCreated(true)
      setStep('user')
      toast.success('Organization created!')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authApi.register({ ...userForm, tenant_slug: orgForm.slug })
      setAuth(data.user, data.access_token, data.refresh_token, orgForm.slug)
      navigate('/')
      toast.success('Welcome to ChatSphere! 🎉')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Get started" subtitle={step === 'org' ? 'Create your organization' : 'Create your account'}>
      {step === 'org' ? (
        <form onSubmit={createOrg} className="space-y-4">
          <StepIndicator current={1} total={2} />
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Organization Name</label>
            <input className="input" placeholder="Acme Corp" value={orgForm.name} onChange={(e) => setOrgForm({ name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Organization Slug</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm">chat.app/</span>
              <input className="input pl-[72px]" placeholder="acme-corp" value={orgForm.slug} onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} required minLength={2} maxLength={100} />
            </div>
            <p className="text-xs text-surface-600 mt-1">Only lowercase letters, numbers, hyphens</p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Continue</span><ArrowRight size={15} /></>}
          </button>
        </form>
      ) : (
        <form onSubmit={createUser} className="space-y-4">
          <StepIndicator current={2} total={2} />
          <div className="p-3 rounded-lg bg-brand-600/10 border border-brand-600/20 text-xs text-brand-300">
            Organization: <span className="font-semibold">{orgForm.name}</span> ({orgForm.slug})
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Username</label>
              <input className="input" placeholder="johndoe" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required minLength={3} />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Display Name</label>
              <input className="input" placeholder="John Doe" value={userForm.display_name} onChange={(e) => setUserForm({ ...userForm, display_name: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Email</label>
            <input className="input" type="email" placeholder="john@acme.com" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Password</label>
            <input className="input" type="password" placeholder="Min 8 characters" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required minLength={8} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Create Account</span><ArrowRight size={15} /></>}
          </button>
        </form>
      )}
      <p className="text-center text-sm text-surface-500 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
      </p>
    </AuthLayout>
  )
}

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-800/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-900/50">
            <MessageSquare size={18} className="text-white" />
          </div>
          <span className="text-xl font-semibold text-surface-100">ChatSphere</span>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h1 className="text-2xl font-semibold text-surface-50 mb-1">{title}</h1>
          <p className="text-surface-500 text-sm mb-6">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={clsx('h-1 flex-1 rounded-full transition-colors', i + 1 <= current ? 'bg-brand-500' : 'bg-surface-700')} />
      ))}
      <span className="text-xs text-surface-500 ml-1">Step {current}/{total}</span>
    </div>
  )
}
