'use client'

import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useModalAnimation } from '@/lib/useModalAnimation'
import { cn } from '@/lib/utils'

interface ModalContextType {
  handleClose: () => void
}

const ModalContext = createContext<ModalContextType | null>(null)

/** Animated close for anything rendered inside a `Modal`. */
export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within Modal')
  }
  return context
}

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeClassName: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: ModalSize
  /** Fill the available height (detail views with long content). */
  tall?: boolean
  /** Extra classes on the overlay. */
  className?: string
  /** Extra classes on the dialog surface. */
  contentClassName?: string
  /** Set false for confirmation dialogs that must be answered. */
  dismissible?: boolean
  'aria-label'?: string
}

/**
 * Shared dialog shell: dimmed overlay, centered surface, fade/scale animation,
 * and click-outside / Escape to close. Compose the inside with `ModalHeader`,
 * `ModalBody` and `ModalFooter`.
 *
 * Children are snapshotted while the exit animation runs, so callers can pass
 * `{thing && <Body thing={thing} />}` and clear `thing` in `onClose`.
 */
export function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  tall = false,
  className,
  contentClassName,
  dismissible = true,
  'aria-label': ariaLabel,
}: ModalProps) {
  const { isClosing, handleClose } = useModalAnimation(onClose, 200, isOpen)
  const lastChildrenRef = useRef<ReactNode>(null)
  if (isOpen) lastChildrenRef.current = children
  const dialogRef = useRef<HTMLDivElement>(null)

  // Portal target only exists on the client; nothing is open during SSR anyway.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!isOpen || !dismissible) return
    const onKey = (event: KeyboardEvent) => {
      // Only the top-most dialog should react to Escape.
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (dialogs[dialogs.length - 1] !== dialogRef.current) return
      if (event.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, dismissible, handleClose])

  if (!mounted || (!isOpen && !isClosing)) return null

  // Rendered at the body so a dialog opened from inside another dialog (or a
  // transformed/blurred ancestor) still covers the whole viewport.
  return createPortal(
    <ModalContext.Provider value={{ handleClose }}>
      <div
        className={cn(
          'fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 backdrop-blur-[2px] p-4 safe-bottom modal-overlay',
          isClosing && 'closing',
          className,
        )}
        onClick={dismissible ? handleClose : undefined}
      >
        <div
          ref={dialogRef}
          role='dialog'
          aria-modal='true'
          aria-label={ariaLabel}
          className={cn(
            'relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-modal modal-content',
            'max-h-[calc(100dvh-2rem)]',
            tall && 'h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-6rem)]',
            sizeClassName[size],
            isClosing && 'closing',
            contentClassName,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {isOpen ? children : lastChildrenRef.current}
        </div>
      </div>
    </ModalContext.Provider>,
    document.body,
  )
}

interface ModalCloseButtonProps {
  onClick?: () => void
  disabled?: boolean
  className?: string
}

/** 44px close target pinned to the top-right of the dialog. */
export function ModalCloseButton({ onClick, disabled, className }: ModalCloseButtonProps) {
  const context = useContext(ModalContext)
  const handleClick = onClick ?? context?.handleClose
  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={disabled}
      aria-label='Close'
      className={cn(
        'absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
    >
      <X className='h-5 w-5' />
    </button>
  )
}

interface ModalHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Rendered after the title on the same row (e.g. a favorite heart). */
  action?: ReactNode
  showClose?: boolean
  closeDisabled?: boolean
  className?: string
  children?: ReactNode
}

export function ModalHeader({
  title,
  description,
  action,
  showClose = true,
  closeDisabled,
  className,
  children,
}: ModalHeaderProps) {
  return (
    <div className={cn('flex-shrink-0 px-5 pt-5 sm:px-6 sm:pt-6', className)}>
      {showClose && <ModalCloseButton disabled={closeDisabled} />}
      <div className={cn('flex items-start gap-2', showClose && 'pr-10')}>
        <h2 className='min-w-0 flex-1 text-xl font-bold leading-tight text-foreground sm:text-2xl'>
          {title}
        </h2>
        {action}
      </div>
      {description && <div className='mt-1 text-sm text-muted-foreground'>{description}</div>}
      {children}
    </div>
  )
}

interface ModalBodyProps {
  children: ReactNode
  className?: string
  /** Let the body scroll while header/footer stay put. Default on. */
  scroll?: boolean
}

export function ModalBody({ children, className, scroll = true }: ModalBodyProps) {
  return (
    <div
      className={cn(
        'min-h-0 flex-1 px-5 py-4 sm:px-6',
        scroll && 'overflow-y-auto overscroll-contain',
        className,
      )}
      data-modal-body
    >
      {children}
    </div>
  )
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

/** Button row. Children usually two `Button`s with `flex-1`. */
export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'flex flex-shrink-0 gap-3 px-5 pb-5 pt-2 sm:px-6 sm:pb-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
