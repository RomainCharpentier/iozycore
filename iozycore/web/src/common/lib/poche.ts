import type { PocketWorkDto } from '@/common/types/api'

/**
 * The pocket copy of the collection: what is owned and what is missing, kept on
 * the device for the one check that cannot wait for the network, "do I have
 * volume 7?" in a shop or at a flea market.
 *
 * It is a copy, and the screen that reads it says so with its date: the rest
 * of the app never shows a number it does not believe, and this one only
 * believes what the server said at that time.
 */
export interface Poche {
  /** ISO instant of the reading. */
  savedAt: string
  works: PocketWorkDto[]
}

const CLE = 'iozycore.poche'

export function lirePoche(): Poche | null {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Partial<Poche> | null
    if (!brut || typeof brut.savedAt !== 'string' || !Array.isArray(brut.works)) return null
    return { savedAt: brut.savedAt, works: brut.works }
  } catch {
    return null
  }
}

export function ecrirePoche(works: PocketWorkDto[], now: Date = new Date()): void {
  try {
    localStorage.setItem(CLE, JSON.stringify({ savedAt: now.toISOString(), works }))
  } catch {
    // Private browsing or a full storage: the app works, there is just no copy.
  }
}

export function effacerPoche(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    // Nothing kept, nothing to clear.
  }
}

/** Lower case, no accents, no punctuation: "Frieren" finds "Sousou no Frieren", "pokemon" finds "Pokémon". */
function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The works whose title holds every word typed, in any order. */
export function chercherDansLaPoche(works: PocketWorkDto[], requete: string): PocketWorkDto[] {
  const mots = normaliser(requete).split(' ').filter(Boolean)
  if (mots.length === 0) return []
  return works.filter((w) => {
    const titre = normaliser(w.title)
    return mots.every((mot) => titre.includes(mot))
  })
}

/** 1, 2, 3, 4, 5, 7, 8 -> "1 à 5, 7, 8": ranges of three or more, pairs stay listed. */
export function plagesDeNumeros(numeros: number[]): string {
  const tries = [...new Set(numeros)].sort((a, b) => a - b)
  const parties: string[] = []
  let debut = 0
  for (let i = 1; i <= tries.length; i++) {
    if (i < tries.length && tries[i] === tries[i - 1] + 1) continue
    const plage = tries.slice(debut, i)
    if (plage.length >= 3) parties.push(`${plage[0]} à ${plage[plage.length - 1]}`)
    else parties.push(...plage.map(String))
    debut = i
  }
  return parties.join(', ')
}

/** What the copy says about one work, in one line. */
export function phraseDeLaPoche(w: PocketWorkDto): string {
  const parties: string[] = []
  // No noun: a volume, an issue or a numbered box read the same way.
  if (w.ownedNumbers.length > 0) parties.push(`tu as : ${plagesDeNumeros(w.ownedNumbers)}`)
  else if (w.ownedLabels.length > 0 || w.ownedCount > 0) parties.push('tu l’as')
  if (w.missingNumbers.length > 0) parties.push(`il te manque : ${plagesDeNumeros(w.missingNumbers)}`)
  if (w.ownedCount === 0 && w.wishedCount > 0) parties.push('dans tes envies')
  const phrase = parties.join(' · ')
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}
