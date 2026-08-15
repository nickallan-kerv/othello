import React, { useEffect, useRef, useState } from 'react'
import { Cell as CellType, BLACK, WHITE } from '../game/othello.js'

type Props = {
  value: CellType,
  onClick: ()=>void,
  onHoverStart?: ()=>void,
  onHoverEnd?: ()=>void,
  onCommitPaint?: (value: CellType)=>void,
  showHint?: boolean,
  r: number,
  c: number,
  isLastPlaced?: boolean,
  isLastFlipped?: boolean,
  previewValue?: CellType
}

export default function Cell({value,onClick,onHoverStart,onHoverEnd,onCommitPaint,showHint,r,c,isLastPlaced,isLastFlipped,previewValue}:Props){
  const COMMIT_FLIP_MS = 900
  const PREVIEW_FLIP_MS = 360
  const prevRef = useRef<CellType>(value)
  const prevPreviewRef = useRef(false)
  const [isFlipping,setIsFlipping] = useState(false)
  const [animate,setAnimate] = useState(false)
  const [flipDurationMs,setFlipDurationMs] = useState(COMMIT_FLIP_MS)
  const flipTimer = useRef<number|undefined>()
  const animateTimer = useRef<number|undefined>()
  const renderedValue = previewValue ?? value
  const isPreviewOverride = previewValue !== undefined && previewValue !== value

  useEffect(()=>{
    const prev = prevRef.current
    const transitionUsesPreview = isPreviewOverride || prevPreviewRef.current
    const duration = transitionUsesPreview ? PREVIEW_FLIP_MS : COMMIT_FLIP_MS
    let paintFrameId: number | undefined

    if(prev !== renderedValue && !isPreviewOverride && renderedValue !== 0){
      paintFrameId = window.requestAnimationFrame(()=>{
        onCommitPaint?.(renderedValue)
      })
    }

    if(prev !== renderedValue && prev !== 0 && renderedValue !== 0){
      // start flip: render flip faces, then add animate class next paint
      setFlipDurationMs(duration)
      setIsFlipping(true)
      // Use double requestAnimationFrame to ensure the element is painted before adding the class
      animateTimer.current = window.requestAnimationFrame(()=>{
        animateTimer.current = window.requestAnimationFrame(()=> setAnimate(true)) as unknown as number
      }) as unknown as number
      // end flip after animation duration (keep a little padding)
      flipTimer.current = window.setTimeout(()=>{
        setAnimate(false)
        setIsFlipping(false)
        prevRef.current = renderedValue
        prevPreviewRef.current = isPreviewOverride
      }, duration + 50)
      return ()=>{
        if(paintFrameId) cancelAnimationFrame(paintFrameId)
        if(animateTimer.current) cancelAnimationFrame(animateTimer.current)
        if(flipTimer.current) clearTimeout(flipTimer.current)
      }
    } else {
      setAnimate(false)
      setIsFlipping(false)
      prevRef.current = renderedValue
      prevPreviewRef.current = isPreviewOverride
      return ()=>{
        if(paintFrameId) cancelAnimationFrame(paintFrameId)
      }
    }
  },[onCommitPaint, renderedValue, isPreviewOverride, r, c])

  const prev = prevRef.current

  const hasMoveHighlight = !!isLastPlaced || !!isLastFlipped

  return (
    <div className={"cell " + (value===0? 'empty':'filled') + (isFlipping? ' flipping':'') + (hasMoveHighlight? ' highlight-cell':'')} onClick={onClick} onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      {isFlipping && prev !== 0 ? (
        <div className="flip-container">
          <div className={"flip " + (animate? 'animate':'') } style={{transitionDuration: `${flipDurationMs}ms`}}>
            <div className={"face front " + (prev===BLACK? 'black':'white')} />
            <div className={"face back " + (renderedValue===BLACK? 'black':'white')} />
          </div>
        </div>
      ) : (
        <>
          {renderedValue===BLACK && <div className={"disc black" + (isLastPlaced? ' last-placed':'') + (isLastFlipped? ' last-flipped':'')} />}
          {renderedValue===WHITE && <div className={"disc white" + (isLastPlaced? ' last-placed':'') + (isLastFlipped? ' last-flipped':'')} />}
          {value===0 && showHint && <div className="valid" />}
        </>
      )}
    </div>
  )
}
