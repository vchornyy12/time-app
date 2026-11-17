'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { connectLLMProvider, removeLLMProvider, updateLLMModel } from '@/lib/actions/llm'
import { LLM_CATALOG, LLM_PROVIDERS, resolveModel, type LLMProvider } from '@/lib/llm/models'

export function LLMKeyCard({ connected, provider, model }: { connected: boolean; provider: LLMProvider; model: string }) {
  // A saved model that is no longer offered shows (and runs) as the provider default.
  const savedModel = resolveModel(provider, model)
  const [key, setKey] = useState('')
  const [selectedProvider, setSelectedProvider] = useState(provider)
  const [selectedModel, setSelectedModel] = useState(savedModel)
  const [feedback, setFeedback] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const info = LLM_CATALOG[selectedProvider]

  function submit(action: () => Promise<{ error?: string }>, success: string) {
    startTransition(async () => {
      try {
        const result = await action()
        setFeedback(result.error ?? success)
        if (!result.error) { setKey(''); router.refresh() }
      } catch {
        setFeedback('Could not update the AI provider connection. Please retry.')
      }
    })
  }

  function chooseProvider(next: LLMProvider) {
    setSelectedProvider(next)
    setSelectedModel(LLM_CATALOG[next].defaultModel)
    setKey('')
  }

  return <div className="mt-4 p-6 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
    <h3 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>AI provider</h3>
    <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
      Connect your own OpenAI or Anthropic API key. It is stored encrypted and used only by the server. Gmail scans send email text to the provider you connect, with this key, and only after you consent.
    </p>
    <label htmlFor="llm-provider" className="block text-sm mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>Provider</label>
    <select id="llm-provider" value={selectedProvider} disabled={pending || connected}
      onChange={e => chooseProvider(e.target.value as LLMProvider)} className="glass-input w-full">
      {LLM_PROVIDERS.map(id => <option key={id} value={id}>{LLM_CATALOG[id].label}</option>)}
    </select>
    <label htmlFor="llm-model" className="block text-sm mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>Model</label>
    <select id="llm-model" value={selectedModel} disabled={pending} onChange={e => setSelectedModel(e.target.value)}
      className="glass-input w-full">
      {info.models.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select>
    {connected ? <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>{info.label} key connected. The saved key can’t be viewed. To switch provider, remove this key first.</p> : <>
      <label htmlFor="llm-key" className="block text-sm mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>{info.keyLabel}</label>
      <input id="llm-key" type="password" autoComplete="new-password" value={key} disabled={pending}
        onChange={e => setKey(e.target.value)} className="glass-input w-full" placeholder={info.keyPlaceholder} />
    </>}
    <div className="flex flex-wrap gap-2 mt-4">
      {connected ? <>
        {selectedModel !== model && <button type="button" disabled={pending} className="btn-primary" onClick={() => submit(() => updateLLMModel(selectedModel), 'Model saved.')}>{pending ? 'Saving…' : 'Save model'}</button>}
        <button type="button" disabled={pending} className="btn-glass" onClick={() => submit(removeLLMProvider, 'API key removed.')}>Remove key</button>
      </>
        : <button type="button" disabled={pending || !key.trim()} className="btn-primary" onClick={() => submit(() => connectLLMProvider({ provider: selectedProvider, key, model: selectedModel }), `${info.label} key verified and saved.`)}>{pending ? 'Checking…' : 'Verify and save key'}</button>}
    </div>
    <p role="status" aria-live="polite" className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>{feedback}</p>
  </div>
}
