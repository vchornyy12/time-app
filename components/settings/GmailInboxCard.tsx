'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Link2Off, Loader2, Mail } from 'lucide-react'
import { disconnectGmail } from '@/lib/actions/gmail'
import type { GmailSettings } from '@/lib/gmail/settings'
import { GmailScanSchedule } from './GmailScanSchedule'
import styles from './GmailInboxCard.module.css'

const statusMessages: Record<string, string> = {
  connected: 'Gmail connection is ready.',
  cancelled: 'Gmail connection was cancelled.',
  invalid_state: 'The connection request expired or could not be verified. Try again.',
  failed: 'Could not connect Gmail. Please retry.',
  missing_scope: 'Gmail read permission was not granted. Please reconnect and allow access.',
  unavailable: 'Gmail is not configured on this server.',
}

export function GmailInboxCard({ settings, available, loadError, result }: {
  settings: GmailSettings | null
  available: boolean
  loadError?: boolean
  result?: string
}) {
  const [feedback, setFeedback] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const connected = !!settings?.connected

  function disconnect() {
    setFeedback('')
    startTransition(async () => {
      try {
        const response = await disconnectGmail()
        setFeedback(response.error ?? 'Gmail disconnected.')
        if (!response.error) router.refresh()
      } catch { setFeedback('Could not disconnect Gmail. Please retry.') }
    })
  }

  return (
    <div className={styles.card}>
      <div className={styles.heading}>
        <div className={styles.identity}><Mail size={20} aria-hidden="true" /><h3 className={styles['title-3']}>Gmail</h3></div>
        {connected ? <span className={styles.connected}><CheckCircle2 size={14} aria-hidden="true" />Connected</span>
          : <span className={styles.disconnected}>Not connected</span>}
      </div>
      <p className={styles['body-6']}>Connect Gmail to scan messages for possible tasks. You control scanning and review every suggestion.</p>
      {!available && <p className={styles['caption-5']}>Gmail setup is not yet available on this server.</p>}
      {loadError && <p role="alert" className={styles['caption-5']}>Could not load Gmail settings. Please refresh and retry.</p>}
      {connected && settings && <p className={styles['caption-5']}>Connected as {settings.account_email}</p>}
      {available && !loadError && connected && <button className={styles['button-sm']} type="button" disabled={pending} onClick={disconnect}>
        {pending ? <Loader2 className={styles.spin} size={14} aria-hidden="true" /> : <Link2Off size={14} aria-hidden="true" />} Disconnect Gmail
      </button>}
      {available && !loadError && connected && <GmailScanSchedule initial={{
        frequency: settings?.scan_frequency ?? 'manual', time: settings?.scan_time?.slice(0, 5) ?? '08:00',
        timezone: settings?.scan_timezone ?? 'UTC', batchSize: settings?.scan_batch_size ?? 50,
        autoConsent: settings?.auto_scan_consent ?? false,
      }} />}
      {available && !loadError && !connected && <a className={styles['button-sm']} href="/api/gmail/auth">Connect Gmail</a>}
      <p role="status" aria-live="polite" className={styles['caption-5']}>{feedback || (result ? statusMessages[result] : '')}</p>
    </div>
  )
}
