import React, { useEffect, useRef, useState } from 'react'
import { Cell as CellType, BLACK, WHITE } from '../game/othello.js'
// ephemeral console-only debug (no overlay)

type Props = { value: CellType, onClick: ()=>void, showHint?: boolean, r: number, c: number, isLastPlaced?: boolean, isLastFlipped?: boolean }

export default function Cell({value,onClick,showHint,r,c,isLastPlaced,isLastFlipped}:Props){
  const prevRef = useRef<CellType>(value)
  const [isFlipping,setIsFlipping] = useState(false)
  const [animate,setAnimate] = useState(false)
  const flipTimer = useRef<number|undefined>()
  const animateTimer = useRef<number|undefined>()

  useEffect(()=>{
    const prev = prevRef.current
    if(prev !== value && prev !== 0 && value !== 0){
      // start flip: render flip faces, then add animate class next paint
      setIsFlipping(true)
      console.log(`flip start cell ${r},${c} ${prev===BLACK? 'BLACK':'WHITE'} -> ${value===BLACK? 'BLACK':'WHITE'}`)
      // Use double requestAnimationFrame to ensure the element is painted before adding the class
      animateTimer.current = window.requestAnimationFrame(()=>{
        animateTimer.current = window.requestAnimationFrame(()=> setAnimate(true)) as unknown as number
      }) as unknown as number
      // end flip after animation duration (keep a little padding)
      flipTimer.current = window.setTimeout(()=>{
        setAnimate(false)
        setIsFlipping(false)
        prevRef.current = value
        console.log(`flip end cell ${r},${c}`)
      }, 950)
      return ()=>{
        if(animateTimer.current) cancelAnimationFrame(animateTimer.current)
        if(flipTimer.current) clearTimeout(flipTimer.current)
      }
    } else {
      setAnimate(false)
      setIsFlipping(false)
      prevRef.current = value
    }
  },[value, r, c])

  const prev = prevRef.current

  return (
    <div className={"cell " + (value===0? 'empty':'filled') + (isFlipping? ' flipping':'')} onClick={onClick}>
      {isFlipping && prev !== 0 ? (
        <div className="flip-container">
          <div className={"flip " + (animate? 'animate':'') }>
            <div className={"face front " + (prev===BLACK? 'black':'white')} />
            <div className={"face back " + (value===BLACK? 'black':'white')} />
          </div>
        </div>
      ) : (
        <>
          {value===BLACK && <div className={"disc black" + (isLastPlaced? ' last-placed':'') + (isLastFlipped? ' last-flipped':'')} />}
          {value===WHITE && <div className={"disc white" + (isLastPlaced? ' last-placed':'') + (isLastFlipped? ' last-flipped':'')} />}
          {value===0 && showHint && <div className="valid" />}
        </>
      )}
    </div>
  )
}
