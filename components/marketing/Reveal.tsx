'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

export const EASE_OUT = [0.16, 1, 0.3, 1] as const

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  /** Distance to rise from, in px. */
  y?: number
  as?: 'div' | 'li' | 'section' | 'p'
}

/** Rises into place the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0, y = 28, as = 'div' }: RevealProps) {
  const Comp = motion[as]
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.9, ease: EASE_OUT, delay }}
    >
      {children}
    </Comp>
  )
}
