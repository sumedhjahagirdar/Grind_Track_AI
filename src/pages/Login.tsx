import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Reveal from '../components/Reveal'
import { Mail, KeyRound, ArrowLeft, Loader2 } from 'lucide-react'

type Mode = 'signin' | 'signup' | 'forgot' | 'reset'

export default function Login() {
  const { signIn } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    if (mode === 'signup') {
      const { error: signUpErr } = await supabase.auth.signUp({ email, password })
      if (signUpErr) {
        setError(signUpErr.message)
        setLoading(false)
        return
      }
      const { error: signInErr } = await signIn(email, password)
      if (signInErr) setError(signInErr)
    } else if (mode === 'signin') {
      const { error: signInErr } = await signIn(email, password)
      if (signInErr) setError(signInErr)
    } else if (mode === 'forgot') {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      if (otpErr) {
        setError(otpErr.message)
      } else {
        setInfo(`A 6-digit verification code was sent to ${email}. Enter it below with your new password.`)
        setMode('reset')
      }
    } else if (mode === 'reset') {
      if (!otp.trim() || otp.trim().length !== 6) {
        setError('Enter the 6-digit code from your email.')
        setLoading(false)
        return
      }
      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters.')
        setLoading(false)
        return
      }
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: 'email',
      })
      if (verifyErr) {
        setError(verifyErr.message)
        setLoading(false)
        return
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) {
        setError(updateErr.message)
        setLoading(false)
        return
      }
      setInfo('Password updated! Redirecting to your dashboard…')
    }
    setLoading(false)
  }

  const showPasswordFields = mode === 'signin' || mode === 'signup'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-ink-50 via-white to-brand-50 dark:from-ink-950 dark:via-ink-950 dark:to-ink-900">
      <div className="w-full max-w-sm">
        <Reveal>
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-glow-500 text-white font-bold shadow-glow-brand">GT</div>
            <div>
              <h1 className="text-xl font-display font-bold text-gradient">GrindTrack AI</h1>
              <p className="text-xs text-ink-500">Your private DSA progress tracker</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={100}>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800 transition -mb-1"
            >
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </button>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              autoFocus={mode !== 'reset'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              disabled={mode === 'reset'}
            />
          </div>

          {showPasswordFields && (
            <div>
              <div className="flex items-center justify-between">
                <label className="label mb-0">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] text-brand-600 hover:text-brand-700 transition"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input mt-1.5"
                placeholder="••••••••"
              />
            </div>
          )}

          {mode === 'forgot' && (
            <div className="flex items-start gap-2 rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-800/40 px-3 py-2.5">
              <Mail className="h-4 w-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-brand-700 dark:text-brand-300 leading-relaxed">
                We'll send a 6-digit verification code to your email. Use it with a new password to reset your account.
              </p>
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label className="label">Verification code</label>
                <input
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="input font-mono text-center text-lg tracking-[0.5em]"
                  placeholder="000000"
                />
              </div>
              <div>
                <label className="label">New password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40 px-3 py-2.5">
                <KeyRound className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  Enter the 6-digit code from your email and choose a new password. You'll be signed in automatically after.
                </p>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {info && !error && (
            <div className="rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-sm text-brand-700">
              {info}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {mode === 'forgot' ? 'Sending code…' : mode === 'reset' ? 'Verifying…' : 'Signing in…'}</>
            ) : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send verification code' : mode === 'reset' ? 'Reset password' : 'Sign in'}
          </button>

          {(mode === 'signin' || mode === 'signup') && (
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="w-full text-center text-xs text-ink-500 hover:text-ink-800 transition"
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="w-full text-center text-xs text-ink-500 hover:text-ink-800 transition"
            >
              Back to sign in
            </button>
          )}
        </form>
        </Reveal>

        <p className="mt-6 text-center text-[11px] text-ink-400 leading-relaxed">
          Single-user app. Your data is private to your account.
        </p>
      </div>
    </div>
  )
}
