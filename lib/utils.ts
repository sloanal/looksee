import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateInviteCode(): string {
  // Generate a simple 6-character alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing chars
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function getAvatarColor(identifier: string): string {
  // Earthy muted colors palette
  const colors = [
    '#8B7355', // Muted brown
    '#7A8471', // Sage green
    '#9B7A5A', // Terracotta
    '#6B7D5A', // Olive
    '#A67C52', // Rust
    '#8B6F47', // Clay
    '#9A8B6F', // Sand
    '#7A6B5A', // Moss
    '#8B7D6B', // Stone
    '#7A8B6F', // Forest
  ]

  // Generate a consistent index from the identifier
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colors[Math.abs(hash) % colors.length]
}

