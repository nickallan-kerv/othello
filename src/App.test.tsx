import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import App from './App.js'
import * as othello from './game/othello.js'

async function advanceAiTurn() {
  await act(async () => {
    vi.advanceTimersByTime(450)
  })
}

function clickFirstValidMove(container: HTMLElement) {
  const hint = container.querySelector('.valid') as HTMLElement | null
  if (!hint || !hint.parentElement) throw new Error('No valid move hint found')
  fireEvent.click(hint.parentElement)
}

function historyListItems() {
  const history = document.querySelector('.history') as HTMLElement
  if (!history) throw new Error('History panel not found')
  return within(history).getAllByRole('listitem')
}

describe('App history interactions', () => {
  test('shows jump tooltip only for Start and past AI moves', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    clickFirstValidMove(container)
    await advanceAiTurn()
    clickFirstValidMove(container)
    await advanceAiTurn()

    const items = historyListItems()
    const start = items[0]
    const blackMove = items.find((li) => li.textContent?.startsWith('Black @'))
    const aiMove = items.find((li) => li.textContent?.startsWith('White @'))

    expect(start).toHaveAttribute('title', 'Double-click to restart from the beginning')
    expect(aiMove).toHaveAttribute('title', 'Double-click to jump back here (your turn next)')
    expect(blackMove).not.toHaveAttribute('title')
  })

  test('double-clicking past AI move truncates history and keeps user turn', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    clickFirstValidMove(container)
    await advanceAiTurn()
    clickFirstValidMove(container)
    await advanceAiTurn()

    const beforeHeader = (document.querySelector('.history') as HTMLElement).textContent || ''
    expect(beforeHeader).toContain('Step 4 of 4')

    const aiMove = historyListItems().find((li) => li.textContent?.startsWith('White @'))
    if (!aiMove) throw new Error('No AI move in history')
    fireEvent.doubleClick(aiMove)

    const afterHeader = (document.querySelector('.history') as HTMLElement).textContent || ''
    expect(afterHeader).toContain('Step 2 of 2')
    expect(screen.getByText(/Turn:/).textContent).toContain('Turn: Black')
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  test('double-clicking Start truncates to initial state', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    clickFirstValidMove(container)
    await advanceAiTurn()

    const start = historyListItems()[0]
    fireEvent.doubleClick(start)

    const historyText = (document.querySelector('.history') as HTMLElement).textContent || ''
    expect(historyText).toContain('Step 0 of 0')
    expect(screen.getByText(/Turn:/).textContent).toContain('Turn: Black')
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  test('hovering a history row previews board state and fades board', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    clickFirstValidMove(container)
    await advanceAiTurn()
    clickFirstValidMove(container)
    await advanceAiTurn()

    const aiMove = historyListItems().find((li) => li.textContent?.startsWith('White @'))
    if (!aiMove) throw new Error('No AI move in history')

    fireEvent.mouseEnter(aiMove)
    expect(screen.getByText(/Turn:/).textContent).toMatch(/previewing step\s+2/)
    expect(container.querySelector('.board-preview-shell.previewing')).toBeTruthy()

    const historyPanel = document.querySelector('.history') as HTMLElement
    fireEvent.mouseLeave(historyPanel)

    expect(screen.getByText(/Turn:/).textContent).not.toContain('previewing step')
    expect(container.querySelector('.board-preview-shell.previewing')).toBeFalsy()
  })

  test('supports AI level changes and still processes AI turns', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    const level = screen.getByLabelText('AI Level:') as HTMLSelectElement

    fireEvent.change(level, { target: { value: 'easy' } })
    clickFirstValidMove(container)
    await advanceAiTurn()
    expect(historyListItems().some((li) => li.textContent?.startsWith('White @'))).toBe(true)

    fireEvent.change(level, { target: { value: 'hard' } })
    clickFirstValidMove(container)
    await advanceAiTurn()
    const aiMoves = historyListItems().filter((li) => li.textContent?.startsWith('White @'))
    expect(aiMoves.length).toBeGreaterThan(1)
  })

  test('invalid clicks do not advance history, and undo/redo/reset behave as expected', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    // Invalid opening click should be ignored.
    const topLeftCell = container.querySelector('.cell') as HTMLElement
    fireEvent.click(topLeftCell)
    expect((document.querySelector('.history') as HTMLElement).textContent || '').toContain('Step 0 of 0')

    clickFirstValidMove(container)
    await advanceAiTurn()
    clickFirstValidMove(container)
    await advanceAiTurn()

    const history = document.querySelector('.history') as HTMLElement
    expect(history.textContent || '').toContain('Step 4 of 4')

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(history.textContent || '').toContain('Step 2 of 4')

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(history.textContent || '').toContain('Step 4 of 4')

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(history.textContent || '').toContain('Step 0 of 0')
    expect(screen.getByText(/Turn:/).textContent).toContain('Turn: Black')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  test('undo while AI is pending returns to previous user turn', () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    clickFirstValidMove(container)
    // Do not advance timers; AI turn has not executed yet.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    const history = document.querySelector('.history') as HTMLElement
    expect(history.textContent || '').toContain('Step 0 of 1')
    expect(screen.getByText(/Turn:/).textContent).toContain('Turn: Black')
  })

  test('hovering non-valid cells does not create preview highlights', () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    const nonValidCell = container.querySelector('.cell:not(.filled)') as HTMLElement
    fireEvent.mouseEnter(nonValidCell)

    expect(container.querySelector('.disc.last-flipped')).toBeFalsy()
    expect(screen.getByText(/Turn:/).textContent).not.toContain('previewing step')

    fireEvent.mouseLeave(nonValidCell)
    expect(screen.getByText(/Turn:/).textContent).toContain('Turn: Black')
  })

  test('shows game-over banner when board is terminal', () => {
    const fullBoard = Array.from({ length: 8 }, () => Array(8).fill(othello.BLACK as othello.Cell))
    const createSpy = vi.spyOn(othello, 'createInitialBoard').mockReturnValue(fullBoard)

    render(<App />)

    expect(screen.getByText('Game Over')).toBeTruthy()
    expect(document.body.textContent || '').toContain('Black: 64')
    createSpy.mockRestore()
  })
})
