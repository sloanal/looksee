import { useState, useCallback } from 'react'

export function useModalAnimation(onClose: () => void, delay: number = 200) {
  const [isClosing, setIsClosing] = useState(false)

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, delay)
  }, [onClose, delay])

  return { isClosing, handleClose }
}
