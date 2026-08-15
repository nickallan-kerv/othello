import React, { useEffect, useMemo, useRef, useState } from 'react'
import Board from './components/Board.js'
import Picker from 'react-mobile-picker'
import { createInitialBoard, BLACK, WHITE, Cell as CellType, getValidMoves, applyMove, score, randomMove, greedyMove, minimaxMove, isGameOver, opponent, flipsForMove } from './game/othello.js'

interface MoveRecord {
  player: CellType
  r: number
  c: number
  score: { black:number, white:number }
  flipped?: [number,number][]
}

interface TauntBubble {
  id: number
  text: string
  x: number
  y: number
  vx: number
  vy: number
  age: number
  opacity: number
}

export default function App(){
  const [player] = useState<CellType>(BLACK) // human
  const [aiLevel,setAiLevel] = useState<'easy'|'medium'|'hard'>('medium')
  const [thinking,setThinking] = useState(false)
  const [tauntBubbles,setTauntBubbles] = useState<TauntBubble[]>([])
  const nextTauntBubbleId = useRef(1)
  const tauntAnimFrame = useRef<number | undefined>()
  const tauntLastTs = useRef<number | undefined>()
  const [usedTaunts, setUsedTaunts] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<Array<{ board: CellType[][], turn: CellType, move?: MoveRecord }>>(()=>[
    { board: createInitialBoard(), turn: BLACK }
  ])
  const [historyIndex, setHistoryIndex] = useState(0)
  const historyIndexRef = useRef(0)
  const [shouldAutoPlayAi, setShouldAutoPlayAi] = useState(false)
  const [hoveredMoveKey, setHoveredMoveKey] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const historyStepCarryRef = useRef(0)
  const historyMomentumVelocityRef = useRef(0)
  const historyMomentumFrameRef = useRef<number | undefined>()
  const historyTouchLastYRef = useRef<number | null>(null)
  const historyTouchLastTsRef = useRef<number | null>(null)
  const hadLatestGameOverRef = useRef(false)

  const current = history[historyIndex]
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

  // Expanded taunt pools with Monty-Python-style silly name-calling (lighthearted)
  const tauntPools = useMemo(()=>({
    bigPlayerLead: [
      "This is preposterous — you jammy codpiece!",
      "By the saints, you're a flukey, pudding-brained ninny!",
      "I protest! You absolute berk of extraordinary majesty!",
      "You blithering, bungling popinjay of triumph!",
      "Egad, you're a triumphant, cushy-witted scallywag!",
      "Fiddle-dee, what a splendidly stupid victory you carve!",
      "Zounds! A most improbable, scrumptious fluke you've pulled!",
      "You incorrigible, plummy-headed conqueror of discs!",
      "By Jove, your play is like warm custard — oddly effective!",
      "I bow to your muffin-brained brilliance."
    ],
    medPlayerLead: [
      "You daft, bubble-headed scoundrel — well played.",
      "I'll have you know this was just training wheels, you plonker.",
      "Careful, you might start believing your own flummery.",
      "Bravo, you splendid, noodle-headed strategist.",
      "Marvellous — a cunning little turn from you, you scone-brained elf.",
      "You're making me look careless, you tart-faced prodigy.",
      "Dazzling! A tricksy, whimsical coup, you little berk.",
      "A fine turn, you prat with a plan.",
      "Good show, you perspicacious turnip.",
      "I concede — momentarily — to your plucky brilliance."
    ],
    smallPlayerLead: [
      "You're ahead — but don't crow yet, you cheeky sod.",
      "Steady on, you splendid oaf, the game's not over.",
      "Nice — don't let it go to your head, you daft git.",
      "A tidy move, you curious muffin.",
      "Keep it up, you brilliant, bungling genius.",
      "Well played, you soft-headed marvel.",
      "Oh ho, you're making faces at fortune, you sly turnip.",
      "A neat flip, you merry dodger.",
      "Clever — like a fox in a hat, you rascal.",
      "Tuning your racket nicely, you honey-headed chap."
    ],
    neutral: [
      "It's anyone's game — don't be a prat.",
      "Lovely move, you cunning turnip.",
      "Tension! Keep your wits, you eccentric codswallop.",
      "A jolly tussle — keep at it, you plum-headed champion.",
      "Splendid! The board's a kettle of surprises.",
      "Nicely done — you're a right sprightly noodle.",
      "Oh, the suspense! Carry on, you curious radish.",
      "A patient plod of strategy — bravo, you little toff.",
      "Fun times — behave like a sensible cabbage.",
      "Goodness me, this is a proper dashing duel."
    ],
    smallAiLead: [
      "I was merely toying with you, you muddle-headed twerp.",
      "Oh dear, you slipped — easily done for a muppet.",
      "Perhaps next time, try not to be so splendiferously inept.",
      "A small advantage — don't blubber, you noodly fellow.",
      "I nibble at your heels, you charmingly vacant goon.",
      "Careful now, the tide favors me, you daft cucumber.",
      "A slight lead; you might need a stronger spoon next time.",
      "Tempting mistake — well observed from my side, you clumsy toddle.",
      "It's little things that add up, you lovely dunderhead.",
      "I'm merely prodigious in small ways, you delectable prat."
    ],
    medAiLead: [
      "I say, that was child's play — you confounded twit.",
      "Honestly, you handle defeat like a fainting turnip.",
      "One might call that a lesson, you dreadful nincompoop.",
      "Tsk — a proper rout if you keep at that pace, you blathering prat.",
      "Consider this a demonstration, you silly, soppy wretch.",
      "You're being educational — thank you for the example, you doltish chap.",
      "A most instructive blunder you offered there, you noodle.",
      "I find this sport restful; you find it enlightening, you bungling cad.",
      "Hardly a challenge — but, bless you, you tried, you ploppy toff.",
      "A tidy error; I applaud your generous contribution, you softheaded twit."
    ],
    bigAiLead: [
      "Too easy — you ridiculous, soggy-bottomed worm!",
      "Is that your best? You perfidious, dribbling codger.",
      "I could nap and still outplay you, you blithering wazzock.",
      "Absolute triumph — you magnificent, splenetic turnip.",
      "A crushing display; your tactics are delightfully tragic, you plonking muffin.",
      "I'm impressed by your consistency at making mistakes, you prat of note.",
      "My dear, you've invented a new form of error, you puffy-necked beast.",
      "What a spectacle — you, a glorious, befuddled doofus.",
      "I shall write about your approximately dreadful moves, you soggy prat.",
      "Rest assured, I remain unimpressed by your culinary-level strategy."
    ]
  }), [])

  function pickTaunt(diff:number){
    // diff = black - white (positive -> human leading)
    let pool:string[]
    if(diff >= 12) pool = tauntPools.bigPlayerLead
    else if(diff >= 5) pool = tauntPools.medPlayerLead
    else if(diff >= 1) pool = tauntPools.smallPlayerLead
    else if(diff <= -12) pool = tauntPools.bigAiLead
    else if(diff <= -5) pool = tauntPools.medAiLead
    else if(diff <= -1) pool = tauntPools.smallAiLead
    else pool = tauntPools.neutral

    // filter pool by unused taunts to reduce repetition
    const available = pool.filter(t => !usedTaunts.has(t))
    let choice: string
    if(available.length === 0){
      // all used, reset used for this pool
      // remove pool items from used set
      setUsedTaunts(prev => {
        const next = new Set(prev)
        pool.forEach(p=> next.delete(p))
        return next
      })
      choice = pool[Math.floor(Math.random()*pool.length)]
    } else {
      choice = available[Math.floor(Math.random()*available.length)]
    }
    // mark chosen taunt as used
    setUsedTaunts(prev => {
      const next = new Set(prev)
      next.add(choice)
      return next
    })
    return choice
  }

  function spawnTauntBubble(text:string){
    const containerRect = containerRef.current?.getBoundingClientRect()
    const width = containerRect?.width ?? 900
    const height = containerRect?.height ?? 620
    const boardEl = containerRef.current?.querySelector('.board') as HTMLDivElement | null
    const boardRect = boardEl?.getBoundingClientRect()
    const isNarrowViewport = width < 520
    const bubbleWidth = Math.min(320, Math.max(220, width * (isNarrowViewport ? 0.74 : 0.62)))
    const bubbleHeight = 88
    const boardCenteredX = containerRect && boardRect
      ? (boardRect.left - containerRect.left) + (boardRect.width - bubbleWidth) / 2
      : (width - bubbleWidth) / 2
    let baseX = Math.max(0, Math.min(width - bubbleWidth, boardCenteredX))
    let baseY = Math.max(50, (height - bubbleHeight) / 2)

    if(containerRect && validMoves.length > 0){
      if(boardEl){
        const liveBoardRect = boardEl.getBoundingClientRect()
        const boardLeft = liveBoardRect.left - containerRect.left
        const boardTop = liveBoardRect.top - containerRect.top
        const cellWidth = liveBoardRect.width / 8
        const cellHeight = liveBoardRect.height / 8

        const rows = validMoves.map(([r]) => r)
        const cols = validMoves.map(([,c]) => c)
        const minRow = Math.min(...rows)
        const maxRow = Math.max(...rows)
        const minCol = Math.min(...cols)
        const maxCol = Math.max(...cols)

        // Approximate the full hint zone and add padding so taunts remain clearly separate.
        const avoid = {
          left: boardLeft + minCol * cellWidth + cellWidth * 0.12,
          top: boardTop + minRow * cellHeight + cellHeight * 0.12,
          right: boardLeft + (maxCol + 1) * cellWidth - cellWidth * 0.12,
          bottom: boardTop + (maxRow + 1) * cellHeight - cellHeight * 0.12
        }

        const intersectsAvoid = (x:number, y:number)=>{
          const right = x + bubbleWidth
          const bottom = y + bubbleHeight
          return x < avoid.right && right > avoid.left && y < avoid.bottom && bottom > avoid.top
        }

        if(intersectsAvoid(baseX, baseY)){
          const margin = 14
          const aboveY = avoid.top - bubbleHeight - margin
          const belowY = avoid.bottom + margin
          const leftX = avoid.left - bubbleWidth - margin
          const rightX = avoid.right + margin
          const centeredX = Math.max(0, Math.min(width - bubbleWidth, boardCenteredX))
          const centeredY = Math.max(0, Math.min(height - bubbleHeight, (height - bubbleHeight) / 2))

          const clampX = (x:number)=> Math.max(0, Math.min(width - bubbleWidth, x))
          const clampY = (y:number)=> Math.max(0, Math.min(height - bubbleHeight, y))
          const placed = (x:number, y:number)=>{
            const px = clampX(x)
            const py = clampY(y)
            return { x: px, y: py, intersects: intersectsAvoid(px, py) }
          }

          const candidates = [
            placed(centeredX, belowY),
            placed(leftX, centeredY),
            placed(rightX, centeredY),
            placed(centeredX, aboveY)
          ]

          const chosen = candidates.find(c => !c.intersects)
          if(chosen){
            baseX = chosen.x
            baseY = chosen.y
          }
        }

        baseX = Math.max(0, Math.min(width - bubbleWidth, baseX))
        baseY = Math.max(0, Math.min(height - bubbleHeight, baseY))
      }
    }

    const id = nextTauntBubbleId.current++

    const bubble: TauntBubble = {
      id,
      text,
      x: baseX + (Math.random() * 8 - 4),
      y: baseY + (Math.random() * 12 - 6),
      vx: Math.random() * 16 - 8,
      vy: 8 + Math.random() * 6,
      age: 0,
      opacity: 1
    }

    setTauntBubbles(prev => {
      const next = [...prev, bubble]
      return next.slice(-3)
    })
  }

  useEffect(()=>{
    if(tauntBubbles.length===0){
      if(tauntAnimFrame.current) cancelAnimationFrame(tauntAnimFrame.current)
      tauntAnimFrame.current = undefined
      tauntLastTs.current = undefined
      return
    }

    const gravity = 22
    const driftDamping = 0.998
    const fadeStartAge = 2.4

    const tick = (ts:number)=>{
      const prevTs = tauntLastTs.current ?? ts
      const dt = Math.min((ts - prevTs) / 1000, 0.05)
      tauntLastTs.current = ts

      setTauntBubbles(prev => prev
        .map((b, index, all) => {
          const vx = b.vx * driftDamping
          const vy = b.vy + gravity * dt
          const x = b.x + vx * dt
          const y = b.y + vy * dt
          const age = b.age + dt
          const falling = vy > 0
          const isOldestOfThree = all.length >= 3 && index === 0
          const fadeRate = isOldestOfThree ? 1.45 : (falling ? 0.22 : 0.07)
          const fadeStart = isOldestOfThree ? 0.1 : fadeStartAge
          const opacityLoss = age > fadeStart ? dt * fadeRate : 0
          const opacity = Math.max(0, b.opacity - opacityLoss)
          return { ...b, x, y, vx, vy, age, opacity }
        })
        .filter(b => b.opacity > 0.02 && b.age < 18 && b.y < 1200)
      )

      tauntAnimFrame.current = window.requestAnimationFrame(tick) as unknown as number
    }

    tauntAnimFrame.current = window.requestAnimationFrame(tick) as unknown as number
    return ()=>{
      if(tauntAnimFrame.current) cancelAnimationFrame(tauntAnimFrame.current)
      tauntAnimFrame.current = undefined
      tauntLastTs.current = undefined
    }
  },[tauntBubbles.length])

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
        const diff = sc.black - sc.white
        const message = pickTaunt(diff)
        spawnTauntBubble(message)
        return
      }

    if(!shouldAutoPlayAi) return

    const doAi = async ()=>{
      setThinking(true)
      await new Promise(r=>setTimeout(r,350))
      let mv = null
      if(aiLevel==='easy') mv = randomMove(board,turn)
      else if(aiLevel==='medium') mv = greedyMove(board,turn)
      else mv = minimaxMove(board,turn,6)
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
            // show highlight for this AI move (no temporary expiry)
            const diff = sc.black - sc.white
            const message = pickTaunt(diff)
            spawnTauntBubble(message)
          }
      }
      setThinking(false)
      setShouldAutoPlayAi(false)
    }
    doAi()
  },[turn,aiLevel,board,player,history,historyIndex,shouldAutoPlayAi,validMoves])

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
    setShouldAutoPlayAi(false)
    setTauntBubbles([])
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
    applyHistoryStepDelta(event.deltaY / 52)

    // Keep rolling after fast sweeps.
    const boosted = historyMomentumVelocityRef.current + event.deltaY * 0.17
    startHistoryMomentum(boosted)
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

    const stepDelta = dy / 40
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

  useEffect(()=>()=>{
    cancelHistoryMomentum()
  },[])

  useEffect(()=>{
    if(turn !== player){
      setHoveredMoveKey(null)
    }
  },[turn, player])

  useEffect(()=>{
    const latestGameOver = isAtLatestHistory && isGameOver(board)
    if(latestGameOver && !hadLatestGameOverRef.current){
      const sc = score(board)
      const message = pickTaunt(sc.black - sc.white)
      spawnTauntBubble(message)
    }
    hadLatestGameOverRef.current = latestGameOver
  },[board, isAtLatestHistory])

  function handleCellClick(r:number,c:number){
    if(turn!==player) return
    setHoveredMoveKey(null)
    const flips = flipsForMove(board,r,c,player)
    const nb = applyMove(board,r,c,player)
    if(!nb) return
    const sc = score(nb)
    pushHistory(nb, WHITE, { player, r, c, score: sc, flipped: flips })
    setShouldAutoPlayAi(true)
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

  const sc = score(renderedBoard)
  const liveScore = score(board)
  const liveGameOver = isGameOver(board)
  const gameResultText = liveScore.black > liveScore.white
    ? 'You win!'
    : liveScore.black < liveScore.white
      ? 'You lose!'
      : 'Draw!'

  const historyPickerValue = useMemo(()=>({ step: String(historyIndex) }),[historyIndex])

  function formatHistoryLabel(index:number){
    const entry = history[index]
    if(!entry) return 'Unknown move'
    if(index === 0) return 'Start'
    if(!entry.move) return 'Unknown move'
    if(entry.move.r === -1) return 'Pass'
    return `${entry.move.player===BLACK ? 'Black' : 'White'} @ ${entry.move.r+1},${entry.move.c+1}`
  }

  return (
    <div className="container" ref={containerRef}>
      <div className="topbar">
        <h1>Othello</h1>
        <div className="controls">
          <label>Level:
            <select value={aiLevel} onChange={e=>setAiLevel(e.target.value as any)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>
      </div>

      <div style={{marginTop:8, marginBottom:6}}>
        <strong>Score:</strong> Black {liveScore.black}, White: {liveScore.white}
      </div>

      <div className="main">
        <div className="board-preview-shell">
          <Board
            board={renderedBoard}
            onCellClick={handleCellClick}
            onCellHover={handleCellHover}
            onCellLeave={handleCellLeave}
            hints={turn===player}
            validMap={validMap}
            lastPlacedKey={lastPlacedKey}
            lastFlippedSet={lastFlippedSet}
            previewFlippedSet={previewFlippedSet}
            previewPlayer={turn===player ? player : null}
          />
        </div>

        <aside className="history">
          <strong>History</strong>
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
                if(Number.isInteger(next)) selectHistoryFromPicker(next)
              }}
              wheelMode="off"
              height={168}
              itemHeight={56}
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
          </div>
        </aside>
      </div>

      <div className="taunt-layer" aria-hidden>
        {tauntBubbles.map(b=> (
          <div key={b.id} className="taunt-bubble" style={{transform:`translate(${b.x}px, ${b.y}px)`, opacity:b.opacity}}>
            {b.text}
          </div>
        ))}
      </div>

      {liveGameOver && <div style={{marginTop:12}}><strong>{gameResultText}</strong></div>}
    </div>
  )
}
