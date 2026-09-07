import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Drives the modal close animation. `handleClose` flips `isClosing`, waits for
 * the exit animation, then calls `onClose`. `isClosing` resets once `onClose`
 * has fired and whenever `isOpen` turns true again, so a modal that is closed
 * and reopened animates in cleanly instead of staying stuck in its exit state.
 */
export function useModalAnimation(
  onClose: () => void,
  delay: number = 200,
  isOpen: boolean = true,
) {
  const [isClosing, setIsClosing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    if (isOpen) {
      clearTimer()
      setIsClosing(false)
    }
  }, [isOpen])

  useEffect(() => clearTimer, [])

  const handleClose = useCallback(() => {
    if (timerRef.current) return
    setIsClosing(true)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      onCloseRef.current()
      setIsClosing(false)
    }, delay)
  }, [delay])

  return { isClosing, handleClose }
}
