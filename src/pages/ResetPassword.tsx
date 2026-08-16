import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Reveal from '../components/Reveal'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setLoading(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateErr) {
      setError(
        updateErr.message.includes('session')
          ? 'This reset link has expired or was already used. Request a new one from the login page.'
          : updateErr.message,
      )
      return
    }
    setDone(true)
    setTimeout(() => navigate('/'), 1800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-ink-50 via-white to-brand-50 dark:from-ink-950 dark:via-ink-950 dark:to-ink-900">
      <div className="w-full max-w-sm">
        <Reveal>
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-glow-500 text-white font-bold shadow-glow-brand">GT</div>
            <div>
              <h1 className="text-xl font-display font-bold text-gradient">GrindTrack AI</h1>
              <p className="text-xs text-ink-500">Set a new password</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={100}>
          {done ? (
            <div className="card p-6 text-center space-y-2">
              <p className="text-sm font-medium text-ink-900">Password updated.</p>
              <p className="text-xs text-ink-500">Taking you to your dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card p-6 space-y-4">
              <div>
                <label className="label">New password</label>
                <input
                  type="password"
                  required
                  autoFocus
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </Reveal>
      </div>
    </div>
  )
}
