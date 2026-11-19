import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CoversThroughServer } from '@/common/lib/coverAddress'
import { Jaquette } from './Jaquette'

const BNF = 'https://catalogue.bnf.fr/couverture?appName=NE&idArk=ark:/12148/cb1&couverture=1'

function image(container: HTMLElement) {
  return container.querySelector('img')
}

describe('Jaquette', () => {
  it('loads a BnF cover through the server, which keeps it and calls the BnF slowly', () => {
    const { container } = render(<Jaquette src={BNF} repli={<span>Repli</span>} />)
    expect(image(container)).toHaveAttribute('src', `/api/covers/image?url=${encodeURIComponent(BNF)}`)
  })

  it('shows the fallback when the server cannot give the cover, never a direct burst', () => {
    const { container } = render(<Jaquette src={BNF} repli={<span>Repli</span>} />)
    fireEvent.error(image(container)!)
    expect(screen.getByText('Repli')).toBeInTheDocument()
  })

  it('loads the BnF directly on the public page, which has no session', () => {
    const { container } = render(
      <CoversThroughServer.Provider value={false}>
        <Jaquette src={BNF} repli={<span>Repli</span>} />
      </CoversThroughServer.Provider>,
    )
    expect(image(container)).toHaveAttribute('src', BNF)
  })

  it('keeps the other hosts direct', () => {
    const url = 'https://s4.anilist.co/file/cover.jpg'
    const { container } = render(<Jaquette src={url} repli={<span>Repli</span>} />)
    expect(image(container)).toHaveAttribute('src', url)
    fireEvent.error(image(container)!)
    expect(screen.getByText('Repli')).toBeInTheDocument()
  })
})
