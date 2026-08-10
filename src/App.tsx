import React, { useEffect, useMemo, useRef, useState } from 'react'
import Board from './components/Board.js'
import { createInitialBoard, BLACK, WHITE, Cell as CellType, getValidMoves, applyMove, score, randomMove, greedyMove, minimaxMove, isGameOver, opponent, flipsForMove } from './game/othello.js'

interface MoveRecord {
  player: CellType
  r: number
  c: number
  score: { black:number, white:number }
  flipped?: [number,number][]
}

export default function App(){
  const [player] = useState<CellType>(BLACK) // human
  const [aiLevel,setAiLevel] = useState<'easy'|'medium'|'hard'>('medium')
  const [thinking,setThinking] = useState(false)
  const [taunt,setTaunt] = useState<string | null>(null)
  const tauntTimer = useRef<number|undefined>()
  const [usedTaunts, setUsedTaunts] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<Array<{ board: CellType[][], turn: CellType, move?: MoveRecord }>>(()=>[
    { board: createInitialBoard(), turn: BLACK }
  ])
  const [historyIndex, setHistoryIndex] = useState(0)
  const historyIndexRef = useRef(0)
  const [shouldAutoPlayAi, setShouldAutoPlayAi] = useState(false)

  const current = history[historyIndex]
  const board = current.board
  const turn = current.turn

  // compute last-move highlights for rendering (always show for selected history entry)
  const lastMove = current.move ?? null
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

  const validMoves = useMemo(()=> getValidMoves(board,turn),[board,turn])
  const validMap = useMemo(()=> new Set(validMoves.map(([r,c])=>`${r},${c}`)),[validMoves])

  const isAtLatestHistory = historyIndex === history.length - 1
  const historyRef = useRef<HTMLDivElement | null>(null)

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
          setHistoryIndex(newIndex)
          historyIndexRef.current = newIndex
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
        setHistoryIndex(newIndex)
        historyIndexRef.current = newIndex
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
            setHistoryIndex(newIndex)
            historyIndexRef.current = newIndex
            // show highlight for this AI move (no temporary expiry)
            const diff = sc.black - sc.white
            const message = pickTaunt(diff)
            setTaunt(message)
            if(tauntTimer.current) clearTimeout(tauntTimer.current)
            tauntTimer.current = window.setTimeout(()=> setTaunt(null), 5000)
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
      setHistoryIndex(newIndex)
      historyIndexRef.current = newIndex
      return trimmed
    })
    // highlight is derived from history entry (no expiry logic)
  }

  useEffect(()=>{
    if(historyRef.current){
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  },[history])

  function handleCellClick(r:number,c:number){
    if(turn!==player) return
    const flips = flipsForMove(board,r,c,player)
    const nb = applyMove(board,r,c,player)
    if(!nb) return
    const sc = score(nb)
    pushHistory(nb, WHITE, { player, r, c, score: sc, flipped: flips })
    setShouldAutoPlayAi(true)
  }

  function handleUndo(){
    setHistoryIndex(prev => {
      const step = prev % 2 === 0 ? 2 : 1
      const next = Math.max(prev - step, 0)
      historyIndexRef.current = next
      return next
    })
    setTaunt(null)
    setShouldAutoPlayAi(false)
  }

  function handleRedo(){
    setHistoryIndex(prev => {
      const step = prev % 2 === 0 ? 2 : 1
      const next = Math.min(prev + step, history.length - 1)
      historyIndexRef.current = next
      return next
    })
    setTaunt(null)
    setShouldAutoPlayAi(false)
  }

  

  const sc = score(board)

  return (
    <div className="container">
      <h1>Othello — Single Player</h1>
      <div className="controls">
        <div>Turn: {turn===BLACK? 'Black' : 'White'} {thinking? '(AI thinking...)': ''}</div>
        <label>AI Level:
          <select value={aiLevel} onChange={e=>setAiLevel(e.target.value as any)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <button onClick={()=>{
          const initial = createInitialBoard()
          setHistory([{ board: initial, turn: BLACK }])
          setHistoryIndex(0)
          historyIndexRef.current = 0
          setShouldAutoPlayAi(false)
          setUsedTaunts(new Set())
          setTaunt(null)
          if(tauntTimer.current) clearTimeout(tauntTimer.current)
        }}>Reset</button>
        <button onClick={handleUndo} disabled={historyIndex===0}>Undo</button>
        <button onClick={handleRedo} disabled={historyIndex >= history.length-1}>Redo</button>
      </div>

      <div className="main">
        <Board board={board} onCellClick={handleCellClick} hints={turn===player} validMap={validMap} lastPlacedKey={lastPlacedKey} lastFlippedSet={lastFlippedSet} />

        <aside ref={el=>historyRef.current = el as HTMLDivElement | null} className="history">
          <strong>History</strong> — Step {historyIndex} of {history.length-1}
          <ol>
            {history.map((entry, index) => (
              <li key={index} style={{fontWeight:index===historyIndex ? 'bold' : 'normal'}}>
                {index===0 ? 'Start' : entry.move ? (entry.move.r === -1 ? 'Pass' : `${entry.move.player===BLACK ? 'Black' : 'White'} @ ${entry.move.r+1},${entry.move.c+1}`) : 'Unknown move'}
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <div style={{marginTop:12}}>
        <strong>Score</strong> — Black: {sc.black} — White: {sc.white}
      </div>

      {taunt && <div className="taunt">{taunt}</div>}

      {isGameOver(board) && <div style={{marginTop:12}}><strong>Game Over</strong></div>}
    </div>
  )
}
