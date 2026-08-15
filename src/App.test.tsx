import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
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

function clickValidMoveByIndex(container: HTMLElement, index: number) {
  const hints = Array.from(container.querySelectorAll('.valid')) as HTMLElement[]
  const hint = hints[index]
  if (!hint || !hint.parentElement) throw new Error(`No valid move hint at index ${index}`)
  fireEvent.click(hint.parentElement)
}

function historyPickerWrap() {
  const picker = document.querySelector('.history-picker-wrap') as HTMLElement | null
  if (!picker) throw new Error('History picker not found')
  return picker
}

function currentHistoryLabel() {
  const selected = document.querySelector('.history-picker-item.is-selected .history-picker-label') as HTMLElement | null
  if (!selected) throw new Error('Selected history label not found')
  return selected.textContent || ''
}

function clickHistoryLabel(label: string) {
  const target = Array.from(document.querySelectorAll('.history-picker-label')).find(
    (el) => el.textContent === label
  ) as HTMLElement | undefined
  if (!target) throw new Error(`History label not found: ${label}`)
  fireEvent.click(target)
}

describe('App history picker interactions', () => {
  test('renders picker and tracks current history selection', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    clickFirstValidMove(container)
    await advanceAiTurn()
    clickFirstValidMove(container)
    await advanceAiTurn()

    expect(historyPickerWrap()).toBeTruthy()
    expect(currentHistoryLabel()).toContain('White @')
  })

  test('selecting a prior history item updates active selection', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    clickFirstValidMove(container)
    await advanceAiTurn()
    clickFirstValidMove(container)
    await advanceAiTurn()

    const latestLabel = currentHistoryLabel()
    clickHistoryLabel('Start')
    const movedLabel = currentHistoryLabel()
    expect(movedLabel).not.toBe(latestLabel)
    expect(movedLabel).toBe('Start')

    clickFirstValidMove(container)
    await advanceAiTurn()
    expect(currentHistoryLabel()).toContain('White @')
  })

  test('branching from a selected older step truncates future history', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    clickFirstValidMove(container)
    await advanceAiTurn()
    clickFirstValidMove(container)
    await advanceAiTurn()

    const oldLatestLabel = currentHistoryLabel()
    clickHistoryLabel('Start')
    expect(currentHistoryLabel()).toBe('Start')

    // Play a different opening branch from Start.
    clickValidMoveByIndex(container, 1)
    await advanceAiTurn()

    // Older future branch labels should be gone after truncation.
    expect(document.body.textContent || '').not.toContain(oldLatestLabel)
  })

  test('supports AI level changes and still processes AI turns', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    const level = screen.getByLabelText('Difficulty:') as HTMLSelectElement

    fireEvent.change(level, { target: { value: 'easy' } })
    clickFirstValidMove(container)
    await advanceAiTurn()
    expect(currentHistoryLabel()).toContain('White @')

    fireEvent.change(level, { target: { value: 'hard' } })
    clickFirstValidMove(container)
    await advanceAiTurn()
    expect(currentHistoryLabel()).toContain('White @')
  })

  test('game-over state shows winner text for terminal board', () => {
    const fullBoard = Array.from({ length: 8 }, () => Array(8).fill(othello.BLACK as othello.Cell))
    const createSpy = vi.spyOn(othello, 'createInitialBoard').mockReturnValue(fullBoard)

    render(<App />)

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('You win')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy()
    expect(document.body.textContent || '').toContain('Black 64, White: 0')
    createSpy.mockRestore()
  })
})
