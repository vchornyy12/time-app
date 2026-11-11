'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { connectOpenAI, removeOpenAI } from '@/lib/actions/llm'

export function LLMKeyCard({ connected, model }: { connected: boolean; model: string }) {
  const [key, setKey] = useState('')
  const [selectedModel, setSelectedModel] = useState(model || 'gpt-4o-mini')
  const [feedback, setFeedback] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit(action: () => Promise<{ error?: string }>, success: string) {
    startTransition(async () => {
      try {
        const result = await action()
        setFeedback(result.error ?? success)
        if (!result.error) { setKey(''); router.refresh() }
      } catch {
        setFeedback('Could not update the OpenAI connection. Please retry.')
      }
    })
  }

  return <div className="mt-4 p-6 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
    <h3 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>AI provider</h3>
    <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
      Connect your OpenAI API key. It is stored encrypted and used only by the server. Email analysis is not enabled yet.
    </p>
    <label htmlFor="openai-model" className="block text-sm mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>Model</label>
    <select id="openai-model" value={selectedModel} disabled={pending} onChange={e => setSelectedModel(e.target.value)}
      className="glass-input w-full">
      <option value="gpt-4o-mini">GPT-4o mini</option>
      <option value="gpt-4o">GPT-4o</option>
    </select>
    {connected ? <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>OpenAI key connected. The saved key can’t be viewed.</p> : <>
      <label htmlFor="openai-key" className="block text-sm mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>OpenAI API key</label>
      <input id="openai-key" type="password" autoComplete="new-password" value={key} disabled={pending}
        onChange={e => setKey(e.target.value)} className="glass-input w-full" placeholder="sk-…" />
    </>}
    <div className="flex flex-wrap gap-2 mt-4">
      {connected ? <button type="button" disabled={pending} className="btn-glass" onClick={() => submit(removeOpenAI, 'OpenAI key removed.')}>Remove key</button>
        : <button type="button" disabled={pending || !key.trim()} className="btn-primary" onClick={() => submit(() => connectOpenAI({ key, model: selectedModel }), 'OpenAI key verified and saved.')}>{pending ? 'Checking…' : 'Verify and save key'}</button>}
    </div>
    <p role="status" aria-live="polite" className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>{feedback}</p>
  </div>
}
