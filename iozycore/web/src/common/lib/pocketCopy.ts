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
export interface PocketCopy {
  /** ISO instant of the reading. */
  savedAt: string
  works: PocketWorkDto[]
}

const KEY = 'iozycore.pocket'

export function readPocketCopy(): PocketCopy | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<PocketCopy> | null
    if (!raw || typeof raw.savedAt !== 'string' || !Array.isArray(raw.works)) return null
    return { savedAt: raw.savedAt, works: raw.works }
  } catch {
    return null
  }
}

export function writePocketCopy(works: PocketWorkDto[], now: Date = new Date()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: now.toISOString(), works }))
  } catch {
    // Private browsing or a full storage: the app works, there is just no copy.
  }
}

export function clearPocketCopy(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing kept, nothing to clear.
  }
}

/** Lower case, no accents, no punctuation: "Frieren" finds "Sousou no Frieren", "pokemon" finds "Pokémon". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The works whose title holds every word typed, in any order. */
export function searchPocketCopy(works: PocketWorkDto[], query: string): PocketWorkDto[] {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return []
  return works.filter((w) => {
    const title = normalize(w.title)
    return words.every((word) => title.includes(word))
  })
}

/** 1, 2, 3, 4, 5, 7, 8 -> "1 à 5, 7, 8": ranges of three or more, pairs stay listed. */
export function numberRanges(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b)
  const parts: string[] = []
  let start = 0
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === sorted[i - 1] + 1) continue
    const range = sorted.slice(start, i)
    if (range.length >= 3) parts.push(`${range[0]} à ${range[range.length - 1]}`)
    else parts.push(...range.map(String))
    start = i
  }
  return parts.join(', ')
}

/** What the copy says about one work, in one line. */
export function pocketLine(w: PocketWorkDto): string {
  const parts: string[] = []
  // No noun: a volume, an issue or a numbered box read the same way.
  if (w.ownedNumbers.length > 0) parts.push(`tu as : ${numberRanges(w.ownedNumbers)}`)
  else if (w.ownedLabels.length > 0 || w.ownedCount > 0) parts.push('tu l’as')
  if (w.missingNumbers.length > 0) parts.push(`il te manque : ${numberRanges(w.missingNumbers)}`)
  if (w.ownedCount === 0 && w.wishedCount > 0) parts.push('dans tes envies')
  const line = parts.join(' · ')
  return line.charAt(0).toUpperCase() + line.slice(1)
}
