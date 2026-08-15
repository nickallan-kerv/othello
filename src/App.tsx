import React, { useEffect, useMemo, useRef, useState } from 'react'
import Board from './components/Board.js'
import Picker from 'react-mobile-picker'
import { createInitialBoard, BLACK, WHITE, Cell as CellType, getValidMoves, applyMove, score, randomMove, greedyMove, minimaxMove, isGameOver, opponent, flipsForMove, getAdaptiveSadisticDepth } from './game/othello.js'

interface MoveRecord {
  player: CellType
  r: number
  c: number
  score: { black:number, white:number }
  flipped?: [number,number][]
}

const AI_THINKING_PHRASES = [
  'Poker face...',
  'Suspicious pause...',
  'Desperate improv...',
  'Professional guessing...',
  'Quantum thinking...',
  'Engaging brain...',
  'Summoning wisdom...',
  'Thinking noises...',
  'Strategic humming...',
  'Definitely planned...',
  'Not panicking...',
  'Trust the process...'
] as const

export default function App(){
  const [player] = useState<CellType>(BLACK) // human
  const [aiLevel,setAiLevel] = useState<'easy'|'medium'|'hard'|'sadistic'>('medium')
  const [thinking,setThinking] = useState(false)
  const [aiStatusText, setAiStatusText] = useState<string>(AI_THINKING_PHRASES[0])
  const [aiPhase, setAiPhase] = useState<'idle'|'waiting-render'|'waiting-delay'|'thinking'>('idle')
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [usedEndGameTaunts, setUsedEndGameTaunts] = useState<Set<string>>(new Set())
  const [endGameTaunt, setEndGameTaunt] = useState('')
  const [history, setHistory] = useState<Array<{ board: CellType[][], turn: CellType, move?: MoveRecord }>>(()=>[
    { board: createInitialBoard(), turn: BLACK }
  ])
  const [historyIndex, setHistoryIndex] = useState(0)
  const historyIndexRef = useRef(0)
  const [hoveredMoveKey, setHoveredMoveKey] = useState<string | null>(null)
  const [showHistoryWhiteHint, setShowHistoryWhiteHint] = useState(false)
  const historyStepCarryRef = useRef(0)
  const historyMomentumVelocityRef = useRef(0)
  const historyMomentumFrameRef = useRef<number | undefined>()
  const historyHintTimerRef = useRef<number | undefined>()
  const historyTouchLastYRef = useRef<number | null>(null)
  const historyTouchLastTsRef = useRef<number | null>(null)
  const hadLatestGameOverRef = useRef(false)
  const aiWorkerRef = useRef<Worker | null>(null)
  const aiWorkerJobIdRef = useRef(0)
  const aiPhraseDeckRef = useRef<string[]>([])
  const lastAiPhraseRef = useRef<string | null>(null)

  const current = history[historyIndex]
  const latestEntry = history[history.length - 1]
  const board = current.board
  const turn = current.turn
  const renderedEntry = current
  const renderedBoard = renderedEntry.board

  // compute last-move highlights for rendering (always show for selected history entry)
  const lastMove = renderedEntry.move ?? null
  const lastPlacedKey = lastMove ? `${lastMove.r},${lastMove.c}` : null
  const lastFlippedSet = lastMove && lastMove.flipped ? new Set(lastMove.flipped.map(([rr,cc])=>`${rr},${cc}`)) : new Set<string>()

  function trimHistoryAfterGameOver(h: Array<{ board: CellType[][], turn: CellType, move?: MoveRecord }>) {
    const idx = h.findIndex(entry => isGameOver(entry.board))
    return idx === -1 ? h : h.slice(0, idx + 1)
  }
  useEffect(()=>{
    historyIndexRef.current = historyIndex
  },[historyIndex])

  const endGameTauntPools = useMemo(()=>(
    {
      win: [
        'A narrow edge, but still yours. Nicely played.',
        'You outmaneuvered me at the end. Well done.',
        'Strong finish. You earned that win.',
        'You kept your shape and closed it out. Respect.',
        'I walked into that trap. Good game.',
        'Calm choices, clean ending. You win.',
        'You read the board better this time. Nice one.',
        'You took control at the right moment. Well played.'
      ],
      lose: [
        'I take this round. Want another?',
        'Good fight. I managed the late game better.',
        'I win this one, but it was close.',
        'Endgame discipline paid off for me there.',
        'That corner sequence decided it. I win.',
        'I held parity until the break came. Good game.',
        'I found the better closing line this time.',
        'I got the final swing. Rematch?'
      ],
      draw: [
        'Dead even. Nice balance all the way through.',
        'A draw. Neither side gave much away.',
        'Level finish. That was a tight game.',
        'We split it perfectly. Good one.',
        'No winner this time. Solid play both sides.',
        'Drawn game. Margins were razor thin.',
        'Balanced from start to finish. We draw.',
        'Nothing between us at the end. Draw.'
      ]
    }
  ),[])

  function pickEndGameTaunt(result:'win'|'lose'|'draw'){
    const pool = endGameTauntPools[result]
    const available = pool.filter(t => !usedEndGameTaunts.has(t))
    const options = available.length > 0 ? available : pool
    const choice = options[Math.floor(Math.random() * options.length)]

    setUsedEndGameTaunts(prev => {
      const next = new Set(prev)
      if(available.length === 0){
        pool.forEach(item => next.delete(item))
      }
      next.add(choice)
      return next
    })

    return choice
  }

  const validMoves = useMemo(()=> getValidMoves(board,turn),[board,turn])
  const validMap = useMemo(()=> new Set(validMoves.map(([r,c])=>`${r},${c}`)),[validMoves])
  const validMoveFlipsMap = useMemo(()=>{
    const map = new Map<string, [number,number][]>()
    for(const [r,c,flips] of validMoves){
      map.set(`${r},${c}`, flips)
    }
    return map
  },[validMoves])
  const previewFlippedSet = useMemo(()=>{
    if(turn !== player || !hoveredMoveKey) return new Set<string>()
    const flips = validMoveFlipsMap.get(hoveredMoveKey) ?? []
    return new Set(flips.map(([rr,cc])=>`${rr},${cc}`))
  },[hoveredMoveKey, player, turn, validMoveFlipsMap])

  const aiDelayMs = aiLevel === 'easy' || aiLevel === 'medium' ? 1000 : 0
  const buildId = import.meta.env.VITE_BUILD_ID || 'dev-local'

  function nextAiPhrase(){
    if(aiPhraseDeckRef.current.length === 0){
      const deck = [...AI_THINKING_PHRASES]
      for(let i = deck.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1))
        ;[deck[i], deck[j]] = [deck[j], deck[i]]
      }

      if(deck.length > 1 && deck[deck.length - 1] === lastAiPhraseRef.current){
        ;[deck[deck.length - 1], deck[deck.length - 2]] = [deck[deck.length - 2], deck[deck.length - 1]]
      }

      aiPhraseDeckRef.current = deck
    }

    const next = aiPhraseDeckRef.current.pop() ?? AI_THINKING_PHRASES[0]
    lastAiPhraseRef.current = next
    return next
  }

  async function chooseAiMove(boardState: CellType[][], turnState: CellType){
    const hardwareThreads = typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
      ? navigator.hardwareConcurrency
      : 8
    const depth = aiLevel === 'hard'
      ? 6
      : aiLevel === 'sadistic'
        ? getAdaptiveSadisticDepth(boardState, turnState, hardwareThreads)
        : 0

    if(typeof Worker === 'undefined'){
      if(aiLevel === 'easy') return randomMove(boardState, turnState)
      if(aiLevel === 'medium') return greedyMove(boardState, turnState)
      return minimaxMove(boardState, turnState, depth)
    }

    if(!aiWorkerRef.current){
      aiWorkerRef.current = new Worker(new URL('./game/aiWorker.ts', import.meta.url), { type: 'module' })
    }

    const worker = aiWorkerRef.current
    const jobId = ++aiWorkerJobIdRef.current

    return await new Promise<{r:number,c:number} | null>((resolve)=>{
      function cleanup(){
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
      }

      function onMessage(event: MessageEvent){
        const data = event.data as { jobId?: number, move?: {r:number,c:number} | null }
        if(data?.jobId !== jobId) return
        cleanup()
        resolve(data.move ?? null)
      }

      function onError(){
        cleanup()
        if(aiLevel === 'easy') resolve(randomMove(boardState, turnState))
        else if(aiLevel === 'medium') resolve(greedyMove(boardState, turnState))
        else resolve(minimaxMove(boardState, turnState, depth))
      }

      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      worker.postMessage({ jobId, board: boardState, turn: turnState, depth, level: aiLevel, hardwareThreads })
    })
  }

  useEffect(()=>()=>{
    aiWorkerRef.current?.terminate()
    aiWorkerRef.current = null
  },[])

  const isAtLatestHistory = historyIndex === history.length - 1

  useEffect(()=>{
    if(!isAtLatestHistory) return
    if(isGameOver(board)) return

    if(turn===player){
      if(validMoves.length===0){
        const opponentMoves = getValidMoves(board, opponent(turn))
        if(opponentMoves.length>0){
          const nextHistory = history.slice(0, historyIndex+1)
          const sc = score(board)
          const newHistory = [...nextHistory, { board, turn: opponent(turn), move: { player: turn, r: -1, c: -1, score: sc } }]
          const trimmed = trimHistoryAfterGameOver(newHistory)
          const newIndex = trimmed.length - 1
          setHistory(trimmed)
          selectHistoryIndex(newIndex)
        }
      }
      return
    }

      if(validMoves.length===0){
        const nextHistory = history.slice(0, historyIndex+1)
        const sc = score(board)
        const newHistory = [...nextHistory, { board, turn: player, move: { player: turn, r: -1, c: -1, score: sc } }]
        const trimmed = trimHistoryAfterGameOver(newHistory)
        const newIndex = trimmed.length - 1
        setHistory(trimmed)
        selectHistoryIndex(newIndex)
        setAiPhase('idle')
        return
      }

    if(aiPhase === 'waiting-render') return

    if(aiPhase === 'waiting-delay'){
      const timerId = window.setTimeout(()=>{
        setAiPhase('thinking')
      }, aiDelayMs)
      return ()=>clearTimeout(timerId)
    }

    if(aiPhase !== 'thinking') return

    let cancelled = false
    const doAi = async ()=>{
      setThinking(true)
      const mv = await chooseAiMove(board, turn)
      if(cancelled) return

      if(mv){
        const nb = applyMove(board,mv.r,mv.c,turn)
        if(nb){
          const sc = score(nb)
          const flips = flipsForMove(history[historyIndex].board, mv.r, mv.c, turn)
          const nextHistory = history.slice(0, historyIndex+1)
          const newHistory = [...nextHistory, { board: nb, turn: turn===BLACK?WHITE:BLACK, move: { player: turn, r: mv.r, c: mv.c, score: sc, flipped: flips }}]
          const trimmed = trimHistoryAfterGameOver(newHistory)
          const newIndex = trimmed.length - 1
          setHistory(trimmed)
          selectHistoryIndex(newIndex)
        }
      }

      setThinking(false)
      setAiPhase('idle')
    }
    doAi()

    return ()=>{
      cancelled = true
      setThinking(false)
    }
  },[turn,aiDelayMs,aiPhase,board,player,history,historyIndex,isAtLatestHistory,validMoves])

  useEffect(()=>{
    if(aiPhase !== 'waiting-render') return
    const fallback = window.setTimeout(()=>{
      setAiPhase(aiDelayMs > 0 ? 'waiting-delay' : 'thinking')
    }, 150)
    return ()=>clearTimeout(fallback)
  },[aiDelayMs, aiPhase])

  function handleBoardCommitPaint(committedValue: CellType){
    if(aiPhase !== 'waiting-render') return
    if(committedValue !== player) return
    setAiPhase(aiDelayMs > 0 ? 'waiting-delay' : 'thinking')
  }

  function pushHistory(nextBoard:CellType[][], nextTurn:CellType, move: MoveRecord){
    setHistory(prevHistory => {
      const currentIndex = historyIndexRef.current
      const nextHistory = prevHistory.slice(0, currentIndex+1)
      const newHistory = [...nextHistory, { board: nextBoard, turn: nextTurn, move }]
      const trimmed = trimHistoryAfterGameOver(newHistory)
      const newIndex = trimmed.length - 1
      selectHistoryIndex(newIndex)
      return trimmed
    })
    // highlight is derived from history entry (no expiry logic)
  }

  function selectHistoryIndex(next:number){
    setHistoryIndex(next)
    historyIndexRef.current = next
  }

  function selectHistoryFromPicker(next:number){
    if(next === historyIndex) return
    setHoveredMoveKey(null)
    setAiPhase('idle')
    selectHistoryIndex(next)
  }

  function cancelHistoryMomentum(){
    if(historyMomentumFrameRef.current){
      cancelAnimationFrame(historyMomentumFrameRef.current)
      historyMomentumFrameRef.current = undefined
    }
  }

  function applyHistoryStepDelta(stepDelta:number){
    if(stepDelta === 0) return

    historyStepCarryRef.current += stepDelta
    let wholeSteps = 0
    if(historyStepCarryRef.current > 0){
      wholeSteps = Math.floor(historyStepCarryRef.current)
    } else if(historyStepCarryRef.current < 0){
      wholeSteps = Math.ceil(historyStepCarryRef.current)
    }
    if(wholeSteps === 0) return

    historyStepCarryRef.current -= wholeSteps
    const prev = historyIndexRef.current
    const next = Math.max(0, Math.min(history.length - 1, prev + wholeSteps))
    if(next !== prev){
      selectHistoryFromPicker(next)
      return
    }

    // Hit an edge: clear residual carry and damp momentum quickly.
    historyStepCarryRef.current = 0
    historyMomentumVelocityRef.current *= 0.2
  }

  function startHistoryMomentum(initialVelocityStepsPerSec:number){
    historyMomentumVelocityRef.current = Math.max(-72, Math.min(72, initialVelocityStepsPerSec))
    if(historyMomentumFrameRef.current) return

    let lastTs = performance.now()
    const tick = (ts:number)=>{
      const dt = Math.min((ts - lastTs) / 1000, 0.05)
      lastTs = ts

      historyMomentumVelocityRef.current *= Math.exp(-9 * dt)
      applyHistoryStepDelta(historyMomentumVelocityRef.current * dt)

      if(Math.abs(historyMomentumVelocityRef.current) < 0.08){
        cancelHistoryMomentum()
        historyMomentumVelocityRef.current = 0
        historyStepCarryRef.current = 0
        return
      }
      historyMomentumFrameRef.current = requestAnimationFrame(tick) as unknown as number
    }

    historyMomentumFrameRef.current = requestAnimationFrame(tick) as unknown as number
  }

  function handleHistoryPickerWheel(event: React.WheelEvent<HTMLDivElement>){
    event.preventDefault()
    event.stopPropagation()

    // Immediate response while scrolling.
    applyHistoryStepDelta(event.deltaY / 140)

    // Keep rolling only after strong sweep-like wheel gestures.
    if(Math.abs(event.deltaY) > 180){
      const boosted = historyMomentumVelocityRef.current + event.deltaY * 0.045
      startHistoryMomentum(boosted)
    }
  }

  function handleHistoryTouchStartCapture(event: React.TouchEvent<HTMLDivElement>){
    const touch = event.touches[0]
    if(!touch) return
    cancelHistoryMomentum()
    historyMomentumVelocityRef.current = 0
    historyStepCarryRef.current = 0
    historyTouchLastYRef.current = touch.clientY
    historyTouchLastTsRef.current = performance.now()
  }

  function handleHistoryTouchMoveCapture(event: React.TouchEvent<HTMLDivElement>){
    const touch = event.touches[0]
    if(!touch || historyTouchLastYRef.current === null || historyTouchLastTsRef.current === null) return

    event.preventDefault()
    event.stopPropagation()

    const now = performance.now()
    const dy = touch.clientY - historyTouchLastYRef.current
    const dt = Math.max((now - historyTouchLastTsRef.current) / 1000, 0.008)

    const stepDelta = -dy / 40
    applyHistoryStepDelta(stepDelta)
    historyMomentumVelocityRef.current = stepDelta / dt

    historyTouchLastYRef.current = touch.clientY
    historyTouchLastTsRef.current = now
  }

  function handleHistoryTouchEndCapture(){
    historyTouchLastYRef.current = null
    historyTouchLastTsRef.current = null
    const velocity = historyMomentumVelocityRef.current
    if(Math.abs(velocity) > 0.55){
      startHistoryMomentum(velocity)
    } else {
      historyMomentumVelocityRef.current = 0
      historyStepCarryRef.current = 0
    }
  }

  useEffect(()=>{
    if(historyHintTimerRef.current){
      clearTimeout(historyHintTimerRef.current)
      historyHintTimerRef.current = undefined
    }

    const entry = history[historyIndex]
    const shouldHint = !!entry && historyIndex > 0 && entry.move?.player === BLACK && entry.turn === BLACK
    if(!shouldHint){
      setShowHistoryWhiteHint(false)
      return
    }

    setShowHistoryWhiteHint(false)
    historyHintTimerRef.current = window.setTimeout(()=>{
      setShowHistoryWhiteHint(true)
      historyHintTimerRef.current = undefined
    }, 1000)
  },[history, historyIndex])

  useEffect(()=>()=>{
    cancelHistoryMomentum()
    if(historyHintTimerRef.current){
      clearTimeout(historyHintTimerRef.current)
    }
  },[])

  useEffect(()=>{
    if(turn !== player){
      setHoveredMoveKey(null)
    }
  },[turn, player])

  useEffect(()=>{
    const latestGameOver = isGameOver(latestEntry.board)
    if(latestGameOver && !hadLatestGameOverRef.current){
      const sc = score(latestEntry.board)
      const result: 'win' | 'lose' | 'draw' = sc.black > sc.white ? 'win' : (sc.black < sc.white ? 'lose' : 'draw')
      setEndGameTaunt(pickEndGameTaunt(result))
    }
    if(!latestGameOver){
      setEndGameTaunt('')
    }
    hadLatestGameOverRef.current = latestGameOver
  },[history])

  function handleCellClick(r:number,c:number){
    if(turn!==player) return
    setHoveredMoveKey(null)
    const flips = flipsForMove(board,r,c,player)
    const nb = applyMove(board,r,c,player)
    if(!nb) return
    const sc = score(nb)
    pushHistory(nb, WHITE, { player, r, c, score: sc, flipped: flips })
    setAiStatusText(nextAiPhrase())
    setAiPhase('waiting-render')
  }

  function handleCellHover(r:number,c:number){
    if(turn!==player){
      setHoveredMoveKey(null)
      return
    }
    const key = `${r},${c}`
    setHoveredMoveKey(validMap.has(key) ? key : null)
  }

  function handleCellLeave(){
    setHoveredMoveKey(null)
  }

  function handlePlayAgain(){
    cancelHistoryMomentum()
    historyStepCarryRef.current = 0
    historyMomentumVelocityRef.current = 0
    setThinking(false)
    setAiPhase('idle')
    setHoveredMoveKey(null)
    setShowHistoryWhiteHint(false)
    setEndGameTaunt('')
    hadLatestGameOverRef.current = false
    const initial = [{ board: createInitialBoard(), turn: BLACK }]
    setHistory(initial)
    selectHistoryIndex(0)
  }

  const liveScore = score(board)
  const gameOverBoard = latestEntry.board
  const gameOverScore = score(gameOverBoard)
  const liveGameOver = isGameOver(gameOverBoard)
  const showAiSpinner = aiPhase !== 'idle' && isAtLatestHistory && turn !== player && !liveGameOver
  const showGameOverDialog = liveGameOver
  const gameResultKey: 'win' | 'lose' | 'draw' = gameOverScore.black > gameOverScore.white
    ? 'win'
    : gameOverScore.black < gameOverScore.white
      ? 'lose'
      : 'draw'
  const gameResultText = gameOverScore.black > gameOverScore.white
    ? 'You win'
    : gameOverScore.black < gameOverScore.white
      ? 'I win'
      : 'We draw'

  useEffect(()=>{
    if(showGameOverDialog && !endGameTaunt){
      setEndGameTaunt(pickEndGameTaunt(gameResultKey))
    }
  },[endGameTaunt, gameResultKey, showGameOverDialog])

  const historyPickerValue = useMemo(()=>({ step: String(historyIndex) }),[historyIndex])

  function toOthelloCoordinate(r:number, c:number){
    const files = 'abcdefgh'
    return `${files[c] ?? '?'}${r + 1}`
  }

  function formatHistoryLabel(index:number){
    const entry = history[index]
    if(!entry) return 'Unknown move'
    if(index === 0) return 'Start'
    if(!entry.move) return 'Unknown move'
    if(entry.move.r === -1) return 'Pass'
    return `${entry.move.player===BLACK ? 'Black' : 'White'} @ ${toOthelloCoordinate(entry.move.r, entry.move.c)}`
  }

  return (
    <div className="container">
      <div className="topbar">
        <h1>Othello</h1>
        <div className="topbar-center">
          {showAiSpinner && (
            <div className="board-ai-status" role="status" aria-live="polite">
              <span className="ai-spinner" aria-hidden />
              <span>{aiStatusText}</span>
            </div>
          )}
        </div>
        <button type="button" className="topbar-instructions" onClick={()=>setShowHelpDialog(true)}>Instructions</button>
      </div>

      <div className="main">
        <div className="board-preview-shell">
          <div className="board-meta">
            <div className="board-meta-main">
              <div className="board-score"><strong>Score:</strong> Black {liveScore.black}, White: {liveScore.white}</div>
              <label className="board-difficulty">Difficulty:
                <select value={aiLevel} onChange={e=>setAiLevel(e.target.value as any)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="sadistic">Sadistic</option>
                </select>
              </label>
            </div>
          </div>
          <Board
            board={renderedBoard}
            onCellClick={handleCellClick}
            onCellHover={handleCellHover}
            onCellLeave={handleCellLeave}
            onCommitPaint={handleBoardCommitPaint}
            hints={turn===player}
            validMap={validMap}
            lastPlacedKey={lastPlacedKey}
            lastFlippedSet={lastFlippedSet}
            previewFlippedSet={previewFlippedSet}
            previewPlayer={turn===player ? player : null}
          />
        </div>

        <aside className="history">
          <div className="history-header-row">
            <strong>History</strong>
            {showHistoryWhiteHint && (
              <span className="history-inline-hint">Select a <em>white</em> move</span>
            )}
          </div>
          <div
            className="history-picker-wrap"
            role="group"
            aria-label="History picker"
            onWheel={handleHistoryPickerWheel}
            onTouchStartCapture={handleHistoryTouchStartCapture}
            onTouchMoveCapture={handleHistoryTouchMoveCapture}
            onTouchEndCapture={handleHistoryTouchEndCapture}
            onTouchCancelCapture={handleHistoryTouchEndCapture}
          >
            <Picker
              className="history-picker"
              value={historyPickerValue}
              onChange={(value)=>{
                const next = Number(value.step)
                if(Number.isInteger(next)){
                  selectHistoryFromPicker(next)
                }
              }}
              wheelMode="off"
              height={120}
              itemHeight={40}
              style={{
                maskImage:'linear-gradient(to top, transparent 0%, rgba(255,255,255,0.85) 8%, white 16%, white 84%, rgba(255,255,255,0.85) 92%, transparent 100%)',
                WebkitMaskImage:'linear-gradient(to top, transparent 0%, rgba(255,255,255,0.85) 8%, white 16%, white 84%, rgba(255,255,255,0.85) 92%, transparent 100%)'
              }}
            >
              <Picker.Column name="step">
                {history.map((_, index)=>(
                  <Picker.Item key={index} value={String(index)}>
                    {({ selected })=> (
                      <div className={`history-picker-item${selected ? ' is-selected' : ''}`}>
                        <span className="history-picker-index">{index}</span>
                        <span className="history-picker-label">{formatHistoryLabel(index)}</span>
                      </div>
                    )}
                  </Picker.Item>
                ))}
              </Picker.Column>
            </Picker>
            <div className="history-picker-focus-overlay" aria-hidden />
          </div>
          <div className="history-build">Build {buildId}</div>
        </aside>
      </div>

      {showGameOverDialog && (
        <div className="game-over-backdrop" role="presentation">
          <div className="game-over-dialog" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
            <h2 id="game-over-title" className="game-over-title">{gameResultText}</h2>
            {endGameTaunt && <p className="game-over-taunt">{endGameTaunt}</p>}
            <button type="button" className="game-over-play-again" onClick={handlePlayAgain}>Play again</button>
          </div>
        </div>
      )}

      {showHelpDialog && (
        <div className="help-backdrop" role="presentation" onClick={(event)=>{
          if(event.target === event.currentTarget){
            setShowHelpDialog(false)
          }
        }}>
          <div className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <h2 id="help-title" className="help-title">Instructions</h2>
            <ol className="help-list">
              <li>You are Black, and Black moves first.</li>
              <li>Each move must trap one or more opponent disks in a straight line.</li>
              <li>Trapped disks flip to your color.</li>
              <li>If you can't move, your turn is skipped.</li>
              <li>When no moves remain, the player with the most disks wins.</li>
            </ol>
            <button type="button" className="help-close" onClick={()=>setShowHelpDialog(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
