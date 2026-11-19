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
export function adresseJaquette(url: string): string {
  return url.includes(BNF_COVER) ? `/api/covers/image?url=${encodeURIComponent(url)}` : url
}
