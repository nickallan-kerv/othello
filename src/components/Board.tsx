import React from 'react'
import Cell from './Cell.js'
import { Cell as CellType, SIZE } from '../game/othello.js'

type Props = {
  board: CellType[][],
  onCellClick: (r:number,c:number)=>void,
  hints?: boolean,
  validMap?: Set<string>
  lastPlacedKey?: string | null,
  lastFlippedSet?: Set<string>
}

export default function Board({board,onCellClick,hints,validMap,lastPlacedKey,lastFlippedSet}:Props){
  return (
    <div className="board" role="grid">
      {board.map((row,r)=>row.map((v,c)=>{
        const key = `${r},${c}`
        const isLastPlaced = lastPlacedKey === key
        const isLastFlipped = !!lastFlippedSet?.has(key)
        return <Cell key={key} value={v} onClick={()=>onCellClick(r,c)} showHint={!!hints && validMap?.has(key)} r={r} c={c} isLastPlaced={isLastPlaced} isLastFlipped={isLastFlipped} />
      }))}
    </div>
  )
}
