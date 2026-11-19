import { beforeEach, describe, expect, it } from 'vitest'
import type { PocketWorkDto } from '@/common/types/api'
import { chercherDansLaPoche, ecrirePoche, effacerPoche, lirePoche, phraseDeLaPoche, plagesDeNumeros } from './poche'

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
    expect(plagesDeNumeros([8, 1, 2, 3, 4, 5, 7])).toBe('1 à 5, 7, 8')
    expect(plagesDeNumeros([1, 2])).toBe('1, 2')
  })

  it('says what is owned and what is missing, in one line', () => {
    expect(phraseDeLaPoche(oeuvre({ ownedCount: 7, ownedNumbers: [1, 2, 3, 4, 5, 7, 8], missingNumbers: [6] }))).toBe(
      'Tu as : 1 à 5, 7, 8 · il te manque : 6',
    )
    expect(phraseDeLaPoche(oeuvre({ title: 'Catan', ownedCount: 1, ownedLabels: ['Catan'] }))).toBe('Tu l’as')
    expect(phraseDeLaPoche(oeuvre({ wishedCount: 1 }))).toBe('Dans tes envies')
  })

  it('finds a title without its accents, its case or its word order', () => {
    const works = [oeuvre({ title: 'Sousou no Frieren' }), oeuvre({ title: 'Pokémon Écarlate' })]
    expect(chercherDansLaPoche(works, 'frieren').map((w) => w.title)).toEqual(['Sousou no Frieren'])
    expect(chercherDansLaPoche(works, 'ecarlate pokemon').map((w) => w.title)).toEqual(['Pokémon Écarlate'])
    expect(chercherDansLaPoche(works, '   ')).toEqual([])
  })

  it('is kept with its date and cleared with the account', () => {
    ecrirePoche([oeuvre({})], new Date('2026-11-19T11:10:00Z'))
    expect(lirePoche()).toEqual({ savedAt: '2026-11-19T11:10:00.000Z', works: [oeuvre({})] })
    effacerPoche()
    expect(lirePoche()).toBeNull()
  })
})
