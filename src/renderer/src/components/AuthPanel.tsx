import { useState } from 'react'
import type { AuthStatus, LanguageId } from '@shared/types'
import { useI18n } from '../i18n'
import { errorText } from '../lib/format'
import { IconAlert, IconCheck, IconReddit, IconRefresh, IconSpinner } from './icons'

interface AuthPanelProps {
  auth: AuthStatus
  onChanged: () => void
  lang?: LanguageId
}

export function AuthPanel({ auth, onChanged, lang = 'en' }: AuthPanelProps): React.JSX.Element {
  const t = useI18n(lang)
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
        {t.checkingSession as string}
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
            {(t.connectedAs as (u: string) => string)(auth.username ?? 'your account')}
          </div>
          <p className="truncate text-xs text-zinc-500">
            {t.cookiesStayInApp as string}
          </p>
        </div>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void run('refresh')}>
          <IconRefresh size={14} />
          {t.recheck as string}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => void run('logout')}>
          {t.logOut as string}
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
          <h2 className="text-sm font-semibold text-zinc-100">{t.logInOnReddit as string}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
            {t.blockedRequestHint as string}
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
          {t.logIn as string}
        </button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void run('refresh')}>
          <IconRefresh size={14} />
          {t.imAlreadyLoggedIn as string}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
