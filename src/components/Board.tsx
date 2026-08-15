import React, { useRef } from 'react'
import Cell from './Cell.js'
import { Cell as CellType, SIZE } from '../game/othello.js'

type Props = {
  board: CellType[][],
  onCellClick: (r:number,c:number)=>void,
  onCellHover?: (r:number,c:number)=>void,
  onCellLeave?: ()=>void,
  hints?: boolean,
  validMap?: Set<string>
  lastPlacedKey?: string | null,
  lastFlippedSet?: Set<string>
  previewFlippedSet?: Set<string>,
  previewPlayer?: CellType | null
}

export default function Board({board,onCellClick,onCellHover,onCellLeave,hints,validMap,lastPlacedKey,lastFlippedSet,previewFlippedSet,previewPlayer}:Props){
  const boardRef = useRef<HTMLDivElement | null>(null)

  function hoverFromTouch(touch: Touch){
    const rect = boardRef.current?.getBoundingClientRect()
    if(!rect) return

    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    if(x < 0 || y < 0 || x > rect.width || y > rect.height){
      onCellLeave?.()
      return
    }

    const col = Math.min(SIZE - 1, Math.max(0, Math.floor((x / rect.width) * SIZE)))
    const row = Math.min(SIZE - 1, Math.max(0, Math.floor((y / rect.height) * SIZE)))
    onCellHover?.(row, col)
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>){
    const touch = event.touches[0]
    if(touch) hoverFromTouch(touch)
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>){
    event.preventDefault()
    const touch = event.touches[0]
    if(touch) hoverFromTouch(touch)
  }

  return (
    <div
      className="board"
      role="grid"
      ref={boardRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={()=>onCellLeave?.()}
      onTouchCancel={()=>onCellLeave?.()}
    >
      {board.map((row,r)=>row.map((v,c)=>{
        const key = `${r},${c}`
        const isLastPlaced = lastPlacedKey === key
        const isLastFlipped = !!lastFlippedSet?.has(key)
        const isPreviewFlipped = !!previewFlippedSet?.has(key)
        const previewValue = isPreviewFlipped ? (previewPlayer ?? undefined) : undefined
        return <Cell key={key} value={v} onClick={()=>onCellClick(r,c)} onHoverStart={()=>onCellHover?.(r,c)} onHoverEnd={()=>onCellLeave?.()} showHint={!!hints && validMap?.has(key)} r={r} c={c} isLastPlaced={isLastPlaced} isLastFlipped={isLastFlipped} previewValue={previewValue} />
      }))}
    </div>
  )
}
