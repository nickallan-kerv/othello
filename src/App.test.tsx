import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import App from './App.js'
import * as othello from './game/othello.js'

async function advanceAiRenderGate() {
  await act(async () => {
    vi.advanceTimersByTime(220)
    await Promise.resolve()
  })
}

async function advanceAiDelay(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
    await Promise.resolve()
  })
}

async function advanceAiTurn() {
  await advanceAiRenderGate()
  await advanceAiDelay(1000)
}

async function flushUpdates() {
  await act(async () => {
    vi.advanceTimersByTime(40)
    await Promise.resolve()
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
    await advanceAiRenderGate()
    await advanceAiDelay(999)
    expect(currentHistoryLabel()).toContain('Black @')
    await advanceAiDelay(1)
    expect(currentHistoryLabel()).toContain('White @')

    fireEvent.change(level, { target: { value: 'medium' } })
    clickFirstValidMove(container)
    await advanceAiRenderGate()
    await advanceAiDelay(999)
    expect(currentHistoryLabel()).toContain('Black @')
    await advanceAiDelay(1)
    expect(currentHistoryLabel()).toContain('White @')

    fireEvent.change(level, { target: { value: 'hard' } })
    clickFirstValidMove(container)
    await advanceAiRenderGate()
    await flushUpdates()
    expect(currentHistoryLabel()).toContain('White @')

    fireEvent.change(level, { target: { value: 'sadistic' } })
    clickFirstValidMove(container)
    await advanceAiRenderGate()
    await flushUpdates()
    expect(currentHistoryLabel()).toContain('White @')
  })

  test('shows and clears AI thinking spinner for all difficulties', async () => {
    vi.useFakeTimers()
    const { container } = render(<App />)
    const level = screen.getByLabelText('Difficulty:') as HTMLSelectElement

    const runCase = async (difficulty: 'easy' | 'medium' | 'hard' | 'sadistic') => {
      fireEvent.change(level, { target: { value: difficulty } })
      clickFirstValidMove(container)

      const status = screen.getByRole('status')
      expect(status).toBeTruthy()
      expect((status.textContent || '').trim().length > 0).toBe(true)

      await advanceAiRenderGate()
      if (difficulty === 'easy' || difficulty === 'medium') {
        await advanceAiDelay(1000)
      } else {
        await flushUpdates()
      }

      expect(screen.queryByRole('status')).toBeNull()
      expect(currentHistoryLabel()).toContain('White @')
    }

    await runCase('easy')
    await runCase('medium')
    await runCase('hard')
    await runCase('sadistic')
  })

  test('help dialog opens and closes from the help link', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Instructions' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Instructions' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('renders compact coordinate layout and history labels use coordinate notation', () => {
    vi.useFakeTimers()
    const { container } = render(<App />)

    const bottomAxis = container.querySelector('.board-axis-row-bottom')
    const topAxis = container.querySelector('.board-axis-row-top')
    const leftAxis = container.querySelector('.board-axis-col-left')
    const rightAxis = container.querySelector('.board-axis-col-right')
    expect(bottomAxis?.textContent).toContain('abcdefgh')
    expect(topAxis).toBeNull()
    expect(leftAxis?.textContent).toContain('12345678')
    expect(rightAxis).toBeNull()

    const level = screen.getByLabelText('Difficulty:') as HTMLSelectElement
    fireEvent.change(level, { target: { value: 'easy' } })
    clickFirstValidMove(container)
    expect(currentHistoryLabel()).toMatch(/^Black @ [a-h][1-8]$/)
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
