import { useState } from 'react'
import type { AuthStatus } from '@shared/types'
import { errorText } from '../lib/format'
import { IconAlert, IconCheck, IconReddit, IconRefresh, IconSpinner } from './icons'

interface AuthPanelProps {
  auth: AuthStatus
  onChanged: () => void
}

export function AuthPanel({ auth, onChanged }: AuthPanelProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: 'login' | 'logout' | 'refresh'): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      if (action === 'login') {
        // openLogin resolves once the login page is loaded. The main process
        // pushes auth state while polling, so don't trigger a recheck here:
        // it would overwrite the "Waiting for Reddit login…" message.
        await window.api.openLogin()
      } else if (action === 'logout') {
        await window.api.logout()
        onChanged()
      } else {
        await window.api.getAuthStatus()
        onChanged()
      }
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (auth.checking && !auth.loggedIn) {
    return (
      <div className="card flex items-center gap-3 px-4 py-3 text-sm text-zinc-400">
        <IconSpinner size={16} className="text-orange-400" />
        Checking your Reddit session…
      </div>
    )
  }

  if (auth.loggedIn) {
    return (
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
          <IconReddit size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <IconCheck size={14} className="text-emerald-400" />
            Connected as u/{auth.username ?? 'your account'}
          </div>
          <p className="truncate text-xs text-zinc-500">
            Logged in with your own Reddit session. Cookies stay in the app.
          </p>
        </div>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void run('refresh')}>
          <IconRefresh size={14} />
          Recheck
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => void run('logout')}>
          Log out
        </button>
        {auth.message && (
          <p className="flex w-full items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
            <IconAlert size={14} className="mt-0.5 shrink-0" />
            {auth.message}
          </p>
        )}
        {error && <p className="w-full text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <div className="card space-y-3 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
          <IconReddit size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-100">Log in on Reddit first</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
            Reddit blocks anonymous content requests. A small Reddit window opens so you can sign in
            normally — the app reuses that session for scanning and downloading.
          </p>
        </div>
      </div>

      {auth.message && auth.message !== 'Not logged in.' && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
          <IconAlert size={14} className="mt-0.5 shrink-0" />
          {auth.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={busy} onClick={() => void run('login')}>
          {busy ? <IconSpinner size={15} /> : <IconReddit size={15} />}
          Log in on Reddit
        </button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void run('refresh')}>
          <IconRefresh size={14} />
          I'm already logged in
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
