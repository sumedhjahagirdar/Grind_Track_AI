import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signupMode, setSignupMode] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (signupMode) {
      const { error: signUpErr } = await supabase.auth.signUp({ email, password })
      if (signUpErr) {
        setError(signUpErr.message)
        setLoading(false)
        return
      }
      const { error: signInErr } = await signIn(email, password)
      if (signInErr) setError(signInErr)
    } else {
      const { error: signInErr } = await signIn(email, password)
      if (signInErr) setError(signInErr)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-ink-50 via-white to-brand-50 dark:from-ink-950 dark:via-ink-950 dark:to-ink-900">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white font-bold">GT</div>
          <div>
            <h1 className="text-xl font-bold text-ink-900">GrindTrack AI</h1>
            <p className="text-xs text-ink-500">Your private DSA progress tracker</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : signupMode ? 'Create account' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={() => { setSignupMode(!signupMode); setError(null) }}
            className="w-full text-center text-xs text-ink-500 hover:text-ink-800 transition"
          >
            {signupMode ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-ink-400 leading-relaxed">
          Single-user app. Your data is private to your account.
        </p>
      </div>
    </div>
  )
}
