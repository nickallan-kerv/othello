import React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import Board from './Board.js'
import Cell from './Cell.js'
import { BLACK, createInitialBoard, WHITE } from '../game/othello.js'

describe('Board', () => {
  test('renders grid cells, hints and forwards click/hover handlers', () => {
    const board = createInitialBoard()
    const onCellClick = vi.fn()
    const onCellHover = vi.fn()
    const onCellLeave = vi.fn()

    const { container } = render(
      <Board
        board={board}
        onCellClick={onCellClick}
        onCellHover={onCellHover}
        onCellLeave={onCellLeave}
        hints
        validMap={new Set(['2,3'])}
      />
    )

    const cells = container.querySelectorAll('.cell')
    expect(cells).toHaveLength(64)
    expect(container.querySelectorAll('.valid')).toHaveLength(1)

    fireEvent.click(cells[0])
    expect(onCellClick).toHaveBeenCalledWith(0, 0)

    fireEvent.mouseEnter(cells[0])
    fireEvent.mouseLeave(cells[0])
    expect(onCellHover).toHaveBeenCalledWith(0, 0)
    expect(onCellLeave).toHaveBeenCalled()
  })

  test('uses preview value for flipped preview cells and move highlight classes', () => {
    const board = createInitialBoard()
    const { container } = render(
      <Board
        board={board}
        onCellClick={() => {}}
        lastPlacedKey="0,0"
        lastFlippedSet={new Set(['0,1'])}
        previewFlippedSet={new Set(['0,2'])}
        previewPlayer={WHITE}
      />
    )

    const cells = container.querySelectorAll('.cell')
    expect(cells[0].className).toContain('highlight-cell')
    expect(cells[1].className).toContain('highlight-cell')

    // Preview causes a rendered white disc at 0,2 even when base value is empty.
    expect(cells[2].querySelector('.disc.white')).toBeTruthy()
  })

  test('does not preview when previewPlayer is null even if preview set contains cell', () => {
    const board = createInitialBoard()
    const { container } = render(
      <Board
        board={board}
        onCellClick={() => {}}
        previewFlippedSet={new Set(['0,2'])}
        previewPlayer={null}
      />
    )

    const cells = container.querySelectorAll('.cell')
    expect(cells[2].querySelector('.disc.white')).toBeFalsy()
    expect(cells[2].querySelector('.disc.black')).toBeFalsy()
  })
})

describe('Cell', () => {
  test('renders hint and highlight classes for empty hint cell', () => {
    const { container } = render(
      <Cell
        value={0}
        onClick={() => {}}
        showHint
        r={1}
        c={2}
        isLastPlaced
      />
    )

    expect(container.querySelector('.valid')).toBeTruthy()
    expect(container.querySelector('.cell')?.className).toContain('highlight-cell')
  })

  test('animates disc flip from black to white and settles on target color', async () => {
    vi.useFakeTimers()
    const { container, rerender } = render(
      <Cell
        value={BLACK}
        onClick={() => {}}
        r={0}
        c={0}
      />
    )

    rerender(
      <Cell
        value={WHITE}
        onClick={() => {}}
        r={0}
        c={0}
      />
    )

    expect(container.querySelector('.cell')?.className).toContain('flipping')

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(container.querySelector('.cell')?.className).not.toContain('flipping')
    expect(container.querySelector('.disc.white')).toBeTruthy()
  })

  test('uses preview flip timing when transition involves preview override', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(
      <Cell
        value={BLACK}
        onClick={() => {}}
        r={0}
        c={1}
      />
    )

    rerender(
      <Cell
        value={BLACK}
        previewValue={WHITE}
        onClick={() => {}}
        r={0}
        c={1}
      />
    )

    const flip = container.querySelector('.flip') as HTMLElement | null
    expect(flip).toBeTruthy()
    expect(flip?.style.transitionDuration).toBe('360ms')
  })
})
