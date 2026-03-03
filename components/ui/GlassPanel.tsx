import { cn } from '@/lib/utils/cn'

interface GlassPanelProps {
  children: React.ReactNode
  className?: string
  as?: React.ElementType
  variant?: 'card' | 'panel'
}

export function GlassPanel({
  children,
  className,
  as: Component = 'div',
  variant = 'card',
}: GlassPanelProps) {
  return (
    <Component className={cn(variant === 'card' ? 'glass-card' : 'glass-panel', className)}>
      {children}
    </Component>
  )
}
