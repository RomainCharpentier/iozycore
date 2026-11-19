import { beforeEach, describe, expect, it } from 'vitest'
import type { PocketWorkDto } from '@/common/types/api'
import { searchPocketCopy, writePocketCopy, clearPocketCopy, readPocketCopy, pocketLine, numberRanges } from './pocketCopy'

function oeuvre(partiel: Partial<PocketWorkDto>): PocketWorkDto {
  return {
    entityId: 'e',
    entityTypeId: 't',
    title: 'One Piece',
    ownedCount: 0,
    totalCount: null,
    wishedCount: 0,
    ownedNumbers: [],
    missingNumbers: [],
    ownedLabels: [],
    ...partiel,
  }
}

describe('the pocket copy', () => {
  beforeEach(() => localStorage.clear())

  it('reads ranges the way one says them', () => {
    expect(numberRanges([8, 1, 2, 3, 4, 5, 7])).toBe('1 à 5, 7, 8')
    expect(numberRanges([1, 2])).toBe('1, 2')
  })

  it('says what is owned and what is missing, in one line', () => {
    expect(pocketLine(oeuvre({ ownedCount: 7, ownedNumbers: [1, 2, 3, 4, 5, 7, 8], missingNumbers: [6] }))).toBe(
      'Tu as : 1 à 5, 7, 8 · il te manque : 6',
    )
    expect(pocketLine(oeuvre({ title: 'Catan', ownedCount: 1, ownedLabels: ['Catan'] }))).toBe('Tu l’as')
    expect(pocketLine(oeuvre({ wishedCount: 1 }))).toBe('Dans tes envies')
  })

  it('finds a title without its accents, its case or its word order', () => {
    const works = [oeuvre({ title: 'Sousou no Frieren' }), oeuvre({ title: 'Pokémon Écarlate' })]
    expect(searchPocketCopy(works, 'frieren').map((w) => w.title)).toEqual(['Sousou no Frieren'])
    expect(searchPocketCopy(works, 'ecarlate pokemon').map((w) => w.title)).toEqual(['Pokémon Écarlate'])
    expect(searchPocketCopy(works, '   ')).toEqual([])
  })

  it('is kept with its date and cleared with the account', () => {
    writePocketCopy([oeuvre({})], new Date('2026-11-19T11:10:00Z'))
    expect(readPocketCopy()).toEqual({ savedAt: '2026-11-19T11:10:00.000Z', works: [oeuvre({})] })
    clearPocketCopy()
    expect(readPocketCopy()).toBeNull()
  })
})
