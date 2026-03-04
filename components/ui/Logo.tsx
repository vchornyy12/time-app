interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
}

const config = {
  sm: { iconSize: 16, className: 'text-base gap-1.5' },
  md: { iconSize: 20, className: 'text-lg gap-2' },
  lg: { iconSize: 28, className: 'text-2xl gap-2.5' },
}

export function Logo({ size = 'md' }: LogoProps) {
  const { iconSize, className } = config[size]
  return (
    <div className={`flex items-center ${className}`} aria-label="time24">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="#3ECF8E" strokeWidth="1.5" />
        <path
          d="M12 7v5l3 2"
          stroke="#3ECF8E"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        time<span style={{ color: '#3ECF8E' }}>24</span>
      </span>
    </div>
  )
}
