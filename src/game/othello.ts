export type Cell = 0 | 1 | 2
export const EMPTY: Cell = 0
export const BLACK: Cell = 1
export const WHITE: Cell = 2

export const SIZE = 8

export function createInitialBoard(): Cell[][]{
  const b: Cell[][] = Array.from({length:SIZE},()=>Array(SIZE).fill(EMPTY))
  b[3][3]=WHITE; b[4][4]=WHITE; b[3][4]=BLACK; b[4][3]=BLACK
  return b
}

const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]

function inBounds(r:number,c:number){return r>=0&&r<SIZE&&c>=0&&c<SIZE}

export function opponent(p:Cell){return p===BLACK?WHITE:BLACK}

export function cloneBoard(board:Cell[][]){return board.map(row=>row.slice())}

export function flipsForMove(board:Cell[][], r:number, c:number, player:Cell): [number,number][]{
  if(board[r][c]!==EMPTY) return []
  const opp = opponent(player)
  const out: [number,number][] = []
  for(const [dr,dc] of DIRS){
    let rr=r+dr, cc=c+dc
    const line: [number,number][] = []
    while(inBounds(rr,cc) && board[rr][cc]===opp){ line.push([rr,cc]); rr+=dr; cc+=dc }
    if(line.length>0 && inBounds(rr,cc) && board[rr][cc]===player){ out.push(...line) }
  }
  return out
}

export function getValidMoves(board:Cell[][], player:Cell): [number,number, [number,number][]][]{
  const res: [number,number,[number,number][]][] = []
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
    const f = flipsForMove(board,r,c,player)
    if(f.length) res.push([r,c,f])
  }
  return res
}

export function applyMove(board:Cell[][], r:number, c:number, player:Cell){
  const b = cloneBoard(board)
  const flips = flipsForMove(b,r,c,player)
  if(flips.length===0) return null
  b[r][c]=player
  for(const [rr,cc] of flips) b[rr][cc]=player
  return b
}

export function score(board:Cell[][]){
  let b=0,w=0
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
    if(board[r][c]===BLACK) b++
    else if(board[r][c]===WHITE) w++
  }
  return {black:b,white:w}
}

export function isGameOver(board:Cell[][]){
  return getValidMoves(board,BLACK).length===0 && getValidMoves(board,WHITE).length===0
}

// AI: random, greedy, minimax
export function randomMove(board:Cell[][], player:Cell){
  const moves = getValidMoves(board,player)
  if(moves.length===0) return null
  const [r,c] = moves[Math.floor(Math.random()*moves.length)]
  return {r,c}
}

export function greedyMove(board:Cell[][], player:Cell){
  const moves = getValidMoves(board,player)
  if(moves.length===0) return null
  let best = moves[0]
  for(const m of moves) if(m[2].length>best[2].length) best=m
  return {r:best[0], c:best[1]}
}

function evaluate(board:Cell[][], player:Cell){
  const s = score(board)
  // disc difference (perspective of `player`)
  const discDiff = (s.black - s.white) * (player===BLACK?1:-1)

  // positional weights (classic Othello weighting matrix)
  const W = [
    [100, -20, 10, 5, 5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [10, -2, 5, 1, 1, 5, -2, 10],
    [5, -2, 1, 0, 0, 1, -2, 5],
    [5, -2, 1, 0, 0, 1, -2, 5],
    [10, -2, 5, 1, 1, 5, -2, 10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10, 5, 5, 10, -20, 100]
  ]
  let posScore = 0
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
    if(board[r][c]===BLACK) posScore += W[r][c]
    else if(board[r][c]===WHITE) posScore -= W[r][c]
  }
  posScore *= (player===BLACK?1:-1)

  // mobility: prefer positions that increase your legal moves and reduce opponent's
  const myMoves = getValidMoves(board, player).length
  const oppMoves = getValidMoves(board, opponent(player)).length
  const mobility = myMoves - oppMoves

  // combine components with tuned weights
  return discDiff * 10 + posScore + mobility * 8
}

export function minimaxMove(board:Cell[][], player:Cell, depth=6){
  const moves = getValidMoves(board,player)
  if(moves.length===0) return null

  function maxValue(b:Cell[][], pl:Cell, d:number, alpha:number, beta:number){
    if(d===0 || isGameOver(b)) return evaluate(b,player)
    let v = -Infinity
    const mvs = getValidMoves(b,pl)
    if(mvs.length===0) return maxValue(b, opponent(pl), d-1, alpha, beta)
    for(const m of mvs){
      const nb = applyMove(b,m[0],m[1],pl)!
      v = Math.max(v, minValue(nb, opponent(pl), d-1, alpha, beta))
      if(v>=beta) return v
      alpha = Math.max(alpha,v)
    }
    return v
  }

  function minValue(b:Cell[][], pl:Cell, d:number, alpha:number, beta:number){
    if(d===0 || isGameOver(b)) return evaluate(b,player)
    let v = Infinity
    const mvs = getValidMoves(b,pl)
    if(mvs.length===0) return minValue(b, opponent(pl), d-1, alpha, beta)
    for(const m of mvs){
      const nb = applyMove(b,m[0],m[1],pl)!
      v = Math.min(v, maxValue(nb, opponent(pl), d-1, alpha, beta))
      if(v<=alpha) return v
      beta = Math.min(beta,v)
    }
    return v
  }

  let bestScore = -Infinity
  let bestMove = moves[0]
  for(const m of moves){
    const nb = applyMove(board,m[0],m[1],player)!
    const v = minValue(nb, opponent(player), depth-1, -Infinity, Infinity)
    if(v>bestScore){ bestScore=v; bestMove=m }
  }
  return {r:bestMove[0], c:bestMove[1]}
}
