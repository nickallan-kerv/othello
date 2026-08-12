import React from 'react'
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
  return (
    <div className="board" role="grid">
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
