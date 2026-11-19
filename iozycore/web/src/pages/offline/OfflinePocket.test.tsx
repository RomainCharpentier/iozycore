import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { PocketWorkDto } from '@/common/types/api'
import { OfflinePocket } from './OfflinePocket'

const ONE_PIECE: PocketWorkDto = {
  entityId: 'op',
  entityTypeId: 'manga',
  title: 'One Piece',
  ownedCount: 7,
  totalCount: null,
  wishedCount: 0,
  ownedNumbers: [1, 2, 3, 4, 5, 7, 8],
  missingNumbers: [6],
  ownedLabels: [],
}

function rendre() {
  render(
    <OfflinePocket
      copy={{ savedAt: '2026-11-19T11:10:00.000Z', works: [ONE_PIECE] }}
      message="Le serveur ne répond pas."
      onRetry={vi.fn()}
      retrying={false}
    />,
  )
}

describe('OfflinePocket', () => {
  it('says it is a copy, with its date, and what it does not hold', () => {
    rendre()
    expect(screen.getByText('Le serveur ne répond pas.')).toBeInTheDocument()
    expect(screen.getByText(/^Copie du 19 novembre.*1 œuvre\. Ce que tu as ajouté depuis n’y est pas\.$/)).toBeInTheDocument()
  })

  it('answers "do I have it" from the copy', () => {
    rendre()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Chercher dans la copie' }), { target: { value: 'one' } })
    expect(screen.getByText('Tu as : 1 à 5, 7, 8 · il te manque : 6')).toBeInTheDocument()
  })

  it('says a title is not there, without pretending it is certain', () => {
    rendre()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Chercher dans la copie' }), { target: { value: 'Akira' } })
    expect(screen.getByText('Pas dans ta collection ni tes envies, d’après cette copie.')).toBeInTheDocument()
  })
})
