import { describe, expect, test, vi } from 'vitest'
import {
  applyMove,
  BLACK,
  cloneBoard,
  createInitialBoard,
  EMPTY,
  flipsForMove,
  getValidMoves,
  getAdaptiveSadisticDepth,
  greedyMove,
  isGameOver,
  minimaxMove,
  opponent,
  randomMove,
  score,
  SIZE,
  WHITE,
  type Cell,
} from './othello.js'

function boardFrom(rows: string[]): Cell[][] {
  return rows.map((row) =>
    row.split('').map((ch) => {
      if (ch === '.') return EMPTY
      if (ch === 'B') return BLACK
      return WHITE
    })
  )
}

describe('othello engine', () => {
  test('creates the standard initial board', () => {
    const board = createInitialBoard()

    expect(board).toHaveLength(SIZE)
    expect(board[0]).toHaveLength(SIZE)
    expect(board[3][3]).toBe(WHITE)
    expect(board[4][4]).toBe(WHITE)
    expect(board[3][4]).toBe(BLACK)
    expect(board[4][3]).toBe(BLACK)
    expect(score(board)).toEqual({ black: 2, white: 2 })
  })

  test('cloneBoard makes a deep copy of rows', () => {
    const board = createInitialBoard()
    const cloned = cloneBoard(board)

    cloned[0][0] = BLACK
    expect(board[0][0]).toBe(EMPTY)
    expect(cloned[0][0]).toBe(BLACK)
  })

  test('opponent swaps black and white', () => {
    expect(opponent(BLACK)).toBe(WHITE)
    expect(opponent(WHITE)).toBe(BLACK)
  })

  test('getValidMoves returns 4 opening moves for black', () => {
    const board = createInitialBoard()
    const moves = getValidMoves(board, BLACK)

    expect(moves).toHaveLength(4)
    const keys = new Set(moves.map(([r, c]) => `${r},${c}`))
    expect(keys).toEqual(new Set(['2,3', '3,2', '4,5', '5,4']))
  })

  test('applyMove returns null for invalid move and board for valid move', () => {
    const board = createInitialBoard()

    const invalid = applyMove(board, 0, 0, BLACK)
    expect(invalid).toBeNull()

    const next = applyMove(board, 2, 3, BLACK)
    expect(next).not.toBeNull()
    expect(next?.[2][3]).toBe(BLACK)
    expect(next?.[3][3]).toBe(BLACK)
    // original board remains unchanged
    expect(board[2][3]).toBe(EMPTY)
    expect(board[3][3]).toBe(WHITE)
  })

  test('randomMove returns null when no valid moves and picks by Math.random otherwise', () => {
    const noMoveBoard = Array.from({ length: SIZE }, () => Array(SIZE).fill(BLACK as Cell))
    expect(randomMove(noMoveBoard, WHITE)).toBeNull()

    const board = createInitialBoard()
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(randomMove(board, BLACK)).toEqual({ r: 2, c: 3 })
    spy.mockRestore()
  })

  test('greedyMove selects move with most flips and handles no moves', () => {
    const noMoveBoard = Array.from({ length: SIZE }, () => Array(SIZE).fill(WHITE as Cell))
    expect(greedyMove(noMoveBoard, BLACK)).toBeNull()

    const custom = boardFrom([
      '........',
      '.B......',
      '.WWWWW..',
      '..B.....',
      '........',
      '........',
      '........',
      '........',
    ])

    const chosen = greedyMove(custom, BLACK)
    expect(chosen).not.toBeNull()

    const moves = getValidMoves(custom, BLACK)
    const maxFlips = Math.max(...moves.map((m) => m[2].length))
    const chosenFlips = flipsForMove(custom, chosen!.r, chosen!.c, BLACK).length
    expect(chosenFlips).toBe(maxFlips)
  })

  test('isGameOver and minimaxMove terminal / non-terminal behavior', () => {
    const fullBoard = Array.from({ length: SIZE }, () => Array(SIZE).fill(BLACK as Cell))
    expect(isGameOver(fullBoard)).toBe(true)
    expect(minimaxMove(fullBoard, WHITE, 4)).toBeNull()

    const board = createInitialBoard()
    const mv = minimaxMove(board, BLACK, 2)
    expect(mv).not.toBeNull()
    const validKeys = new Set(getValidMoves(board, BLACK).map(([r, c]) => `${r},${c}`))
    expect(validKeys.has(`${mv?.r},${mv?.c}`)).toBe(true)
  })

  test('minimax handles pass scenarios where current side has no moves', () => {
    const blackToMoveNoMoves = boardFrom([
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWW.WWWW',
      'WWWBWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
    ])

    // Black has no legal move here; minimax should return null directly.
    expect(getValidMoves(blackToMoveNoMoves, BLACK)).toHaveLength(0)
    expect(getValidMoves(blackToMoveNoMoves, WHITE).length).toBeGreaterThan(0)
    expect(minimaxMove(blackToMoveNoMoves, BLACK, 4)).toBeNull()

    // White does have at least one move and minimax should still return a legal move.
    const whiteMv = minimaxMove(blackToMoveNoMoves, WHITE, 3)
    expect(whiteMv).not.toBeNull()
    const whiteKeys = new Set(getValidMoves(blackToMoveNoMoves, WHITE).map(([r, c]) => `${r},${c}`))
    expect(whiteKeys.has(`${whiteMv?.r},${whiteMv?.c}`)).toBe(true)
  })

  test('adaptive sadistic depth stays bounded and scales down on weaker devices', () => {
    const board = createInitialBoard()

    const strongDeviceDepth = getAdaptiveSadisticDepth(board, BLACK, 8)
    const weakDeviceDepth = getAdaptiveSadisticDepth(board, BLACK, 2)

    expect(strongDeviceDepth).toBeGreaterThanOrEqual(4)
    expect(strongDeviceDepth).toBeLessThanOrEqual(10)
    expect(weakDeviceDepth).toBeGreaterThanOrEqual(4)
    expect(weakDeviceDepth).toBeLessThanOrEqual(10)
    expect(weakDeviceDepth).toBeLessThanOrEqual(strongDeviceDepth)
  })

  test('adaptive sadistic depth increases in constrained late-game positions', () => {
    const opening = createInitialBoard()
    const lateGame = boardFrom([
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWW.WWWW',
      'WWWBWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
    ])

    const openingDepth = getAdaptiveSadisticDepth(opening, BLACK, 8)
    const lateDepth = getAdaptiveSadisticDepth(lateGame, WHITE, 8)

    expect(lateDepth).toBeGreaterThanOrEqual(openingDepth)
    expect(lateDepth).toBeLessThanOrEqual(10)
  })
})
