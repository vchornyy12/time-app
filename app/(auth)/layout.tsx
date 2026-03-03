import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#080b14] overflow-hidden px-4 py-12">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute -top-48 -left-48 w-[640px] h-[640px] rounded-full bg-indigo-600/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-48 w-[560px] h-[560px] rounded-full bg-purple-700/15 blur-[130px]" />
      {children}
    </div>
  )
}
