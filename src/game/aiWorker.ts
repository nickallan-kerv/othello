import { Cell, getAdaptiveSadisticDepth, greedyMove, minimaxMove, randomMove } from './othello.js'

type AiWorkerRequest = {
  jobId: number
  board: Cell[][]
  turn: Cell
  depth: number
  level: 'easy' | 'medium' | 'hard' | 'sadistic'
  hardwareThreads?: number
}

type AiWorkerResponse = {
  jobId: number
  move: { r:number, c:number } | null
}

self.onmessage = (event: MessageEvent<AiWorkerRequest>) => {
  const { jobId, board, turn, depth, level, hardwareThreads } = event.data

  let move: { r:number, c:number } | null
  if(level === 'easy'){
    move = randomMove(board, turn)
  } else if(level === 'medium'){
    move = greedyMove(board, turn)
  } else {
    const searchDepth = level === 'sadistic'
      ? (depth > 0 ? depth : getAdaptiveSadisticDepth(board, turn, hardwareThreads ?? 8))
      : depth
    move = minimaxMove(board, turn, searchDepth)
  }

  const response: AiWorkerResponse = { jobId, move }
  self.postMessage(response)
}
