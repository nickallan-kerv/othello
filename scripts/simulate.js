// Simple Othello simulation (Node) — Black: greedy, White: minimax(depth=3)
const SIZE = 8
const EMPTY = 0, BLACK = 1, WHITE = 2
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]

function createInitialBoard(){
  const b = Array.from({length:SIZE},()=>Array(SIZE).fill(EMPTY))
  b[3][3]=WHITE; b[4][4]=WHITE; b[3][4]=BLACK; b[4][3]=BLACK
  return b
}
function inBounds(r,c){return r>=0&&r<SIZE&&c>=0&&c<SIZE}
function opponent(p){return p===BLACK?WHITE:BLACK}

function flipsForMove(board,r,c,player){
  if(board[r][c]!==EMPTY) return []
  const opp = opponent(player)
  const out = []
  for(const [dr,dc] of DIRS){
    let rr=r+dr, cc=c+dc
    const line=[]
    while(inBounds(rr,cc) && board[rr][cc]===opp){ line.push([rr,cc]); rr+=dr; cc+=dc }
    if(line.length>0 && inBounds(rr,cc) && board[rr][cc]===player) out.push(...line)
  }
  return out
}
function getValidMoves(board,player){
  const res=[]
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){ const f=flipsForMove(board,r,c,player); if(f.length) res.push([r,c,f]) }
  return res
}
function cloneBoard(board){return board.map(row=>row.slice())}
function applyMove(board,r,c,player){ const b=cloneBoard(board); const flips=flipsForMove(b,r,c,player); if(flips.length===0) return null; b[r][c]=player; for(const [rr,cc] of flips) b[rr][cc]=player; return b }
function score(board){ let b=0,w=0; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){ if(board[r][c]===BLACK) b++; else if(board[r][c]===WHITE) w++ } return {black:b,white:w} }
function isGameOver(board){ return getValidMoves(board,BLACK).length===0 && getValidMoves(board,WHITE).length===0 }

function greedyMove(board,player){ const moves = getValidMoves(board,player); if(moves.length===0) return null; let best=moves[0]; for(const m of moves) if(m[2].length>best[2].length) best=m; return {r:best[0],c:best[1]} }

function evaluate(board,player){ const s=score(board); const val=(s.black - s.white) * (player===BLACK?1:-1); const corners=[[0,0],[0,7],[7,0],[7,7]]; let cornerScore=0; for(const [r,c] of corners){ if(board[r][c]===BLACK) cornerScore+=25; else if(board[r][c]===WHITE) cornerScore-=25 } return val+cornerScore }

function minimaxMove(board,player,depth=3){ const moves=getValidMoves(board,player); if(moves.length===0) return null
  function maxValue(b,pl,d,alpha,beta){ if(d===0||isGameOver(b)) return evaluate(b,player); let v=-Infinity; const mvs=getValidMoves(b,pl); if(mvs.length===0) return maxValue(b,opponent(pl),d-1,alpha,beta); for(const m of mvs){ const nb=applyMove(b,m[0],m[1],pl); v=Math.max(v,minValue(nb,opponent(pl),d-1,alpha,beta)); if(v>=beta) return v; alpha=Math.max(alpha,v) } return v }
  function minValue(b,pl,d,alpha,beta){ if(d===0||isGameOver(b)) return evaluate(b,player); let v=Infinity; const mvs=getValidMoves(b,pl); if(mvs.length===0) return minValue(b,opponent(pl),d-1,alpha,beta); for(const m of mvs){ const nb=applyMove(b,m[0],m[1],pl); v=Math.min(v,maxValue(nb,opponent(pl),d-1,alpha,beta)); if(v<=alpha) return v; beta=Math.min(beta,v) } return v }
  let bestScore=-Infinity; let bestMove=moves[0]; for(const m of moves){ const nb=applyMove(board,m[0],m[1],player); const v=minValue(nb,opponent(player),depth-1,-Infinity,Infinity); if(v>bestScore){ bestScore=v; bestMove=m } } return {r:bestMove[0],c:bestMove[1]} }

function printBoard(board){ const lines=[]; for(let r=0;r<SIZE;r++){ let line=''; for(let c=0;c<SIZE;c++){ const v=board[r][c]; line += v===BLACK? 'B ' : v===WHITE? 'W ' : '. ' } lines.push(line) } console.log(lines.join('\n')) }

function simulate(){ let board=createInitialBoard(); let turn=BLACK; let moveNum=1; while(!isGameOver(board)){ const moves=getValidMoves(board,turn); if(moves.length===0){ console.log((turn===BLACK?'Black':'White') + ' has no moves — pass'); turn=opponent(turn); continue }
    let mv=null
    if(turn===BLACK) mv=greedyMove(board,turn)
    else mv=minimaxMove(board,turn,3)
    if(!mv) break
    const nb=applyMove(board,mv.r,mv.c,turn)
    board=nb
    console.log('\nMove ' + moveNum + ' — ' + (turn===BLACK? 'Black':'White') + ' plays ('+mv.r+','+mv.c+')')
    printBoard(board)
    turn=opponent(turn)
    moveNum++
  }
  const sc=score(board)
  console.log('\nFinal Score — Black: '+sc.black+' White: '+sc.white)
}

simulate()
