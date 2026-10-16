export function ReviewError({ error, retry, disabled = false }: { error: string; retry: () => void; disabled?: boolean }) {
  return <div role="alert" className="text-sm"><p>{error}</p><button onClick={retry} disabled={disabled} className="underline">Refresh list</button></div>
}
