import { useState } from 'react'

// Keeps the last non-null value so a dialog title survives its exit animation.
export function useLast<T>(value: T | null): T | null {
  const [last, setLast] = useState(value)
  if (value && value !== last) setLast(value)
  return value ?? last
}
