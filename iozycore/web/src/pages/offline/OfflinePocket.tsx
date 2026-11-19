import { useMemo, useState } from 'react'
import { Search, WifiOff } from 'lucide-react'
import { searchPocketCopy, pocketLine, type PocketCopy } from '@/common/lib/pocketCopy'

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/**
 * The collection without network: the server does not answer (no signal in a
 * shop, the NAS asleep), and the one question is "do I already have it?".
 *
 * It reads the pocket copy kept on the device, and says it is a copy, with its
 * date: what was added since is not in it. Nothing is written from here.
 */
export function OfflinePocket({
  copy,
  message,
  onRetry,
  retrying,
}: {
  copy: PocketCopy
  message: string
  onRetry: () => void
  retrying: boolean
}) {
  const [query, setQuery] = useState('')
  const found = useMemo(() => searchPocketCopy(copy.works, query), [copy.works, query])
  const searching = query.trim().length > 0

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col gap-6 px-4 py-10">
      <p className="font-display text-xl font-bold tracking-[-0.03em] text-textPrimary">
        Iozy<span className="text-accent">Core</span>
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-textDim" role="status">
        <WifiOff size={16} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0">{message}</span>
        <button type="button" onClick={onRetry} disabled={retrying} className="btn-discret -ml-3">
          {retrying ? 'Nouvelle tentative…' : 'Réessayer'}
        </button>
      </div>

      <header>
        <h1 className="font-display text-[clamp(2.5rem,9vw,4rem)] leading-[0.9] font-bold tracking-[-0.05em] text-textPrimary">
          Ta collection, sans réseau
        </h1>
        <p className="mt-3 text-[15px] text-textDim">
          Copie du {DATE.format(new Date(copy.savedAt))}, {copy.works.length} œuvre{copy.works.length > 1 ? 's' : ''}. Ce que tu as ajouté depuis
          n’y est pas.
        </p>
      </header>

      <label className="relative block">
        <span className="sr-only">Chercher dans la copie</span>
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-textDim" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Un title…"
          autoFocus
          className="champ w-full pl-11"
        />
      </label>

      {searching && found.length === 0 && (
        <p className="text-[15px] text-textPrimary">Pas dans ta collection ni tes envies, d’après cette copie.</p>
      )}

      {found.length > 0 && (
        <ul aria-label="Dans la copie" className="flex flex-col">
          {found.slice(0, 40).map((w) => (
            <li key={w.entityId} className="border-t border-line py-3">
              <p className="font-display text-lg font-bold text-textPrimary">{w.title}</p>
              <p className="text-[15px] text-textDim">{pocketLine(w)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
