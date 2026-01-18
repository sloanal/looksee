'use client'

import { ReactNode, createContext, useContext } from 'react'
import { useModalAnimation } from '@/lib/useModalAnimation'

interface AnimatedModalContextType {
  handleClose: () => void
}

const AnimatedModalContext = createContext<AnimatedModalContextType | null>(null)

export function useAnimatedModal() {
  const context = useContext(AnimatedModalContext)
  if (!context) {
    throw new Error('useAnimatedModal must be used within AnimatedModal')
  }
  return context
}

interface AnimatedModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function AnimatedModal({
  isOpen,
  onClose,
  children,
  className = '',
  contentClassName = '',
}: AnimatedModalProps) {
  const { isClosing, handleClose } = useModalAnimation(onClose)

  if (!isOpen && !isClosing) return null

  return (
    <AnimatedModalContext.Provider value={{ handleClose }}>
      <div
        className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-overlay ${isClosing ? 'closing' : ''} ${className}`}
        onClick={handleClose}
      >
        <div
          className={`bg-card rounded-lg max-w-md w-full modal-content ${isClosing ? 'closing' : ''} ${contentClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </AnimatedModalContext.Provider>
  )
}
