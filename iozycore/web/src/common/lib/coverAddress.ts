import { createContext, useContext } from 'react'

const BNF_COVER = 'catalogue.bnf.fr/couverture'

/**
 * Where the browser loads a cover from.
 *
 * The BnF blocks an address for about a quarter of an hour after a burst of a
 * few dozen requests, and a shelf of One Piece asks for 112 covers at once. Its
 * covers therefore go through the server, which keeps each one after the first
 * read and calls the BnF slowly (see CoverImageStore on the server side). The
 * other hosts are CDNs that hold a burst: they stay direct.
 */
export function coverAddress(url: string): string {
  return url.includes(BNF_COVER) ? `/api/covers/image?url=${encodeURIComponent(url)}` : url
}

/**
 * False on the public share page: it has no session, so the server refuses the
 * cover route there, and the covers load from their host.
 */
export const CoversThroughServer = createContext(true)

/** The address to load, following the page: through the server, or direct on the public page. */
export function useCoverAddress(): (url: string) => string {
  const throughServer = useContext(CoversThroughServer)
  return throughServer ? coverAddress : (url) => url
}
