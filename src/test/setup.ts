import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

let rafId = 1
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  const id = rafId++
  setTimeout(() => cb(performance.now()), 16)
  return id
})

vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  clearTimeout(id)
})
