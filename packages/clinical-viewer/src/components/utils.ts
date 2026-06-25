import { clsx, type ClassValue } from 'clsx'

// cn and formatDate are inlined so the package has no @/lib dependency
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: string | Date, format: 'short' | 'long' = 'short') {
  const d = typeof date === 'string' ? new Date(date) : date
  if (format === 'long') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
