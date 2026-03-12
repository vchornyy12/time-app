import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClarityWizard } from '@/components/clarity/ClarityWizard'

export const metadata: Metadata = {
  title: 'Clarity Protocol',
  description: 'Turn anxiety into action with the Willis Carrier formula.',
}

export default async function ClarityPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold gradient-heading">Clarity Protocol</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Stop worrying. Start acting. Based on the Willis Carrier formula.
        </p>
      </div>

      <div
        className="rounded-xl border border-white/10 p-8"
        style={{ background: '#181818' }}
      >
        <ClarityWizard />
      </div>
    </div>
  )
}
