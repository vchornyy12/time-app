'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { getReviewTasks } from '@/lib/actions/review'
import type { Task } from '@/lib/types'

export function useReviewTasks(status: 'waiting_for' | 'next_actions' | 'someday_maybe') {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [isPending, startTransition] = useTransition()
  const busy = useRef(false)

  useEffect(() => {
    let mounted = true
    getReviewTasks(status).then((tasks) => {
      if (mounted) { setTasks(tasks); setError(null) }
    }).catch(() => {
      if (mounted) setError('Could not load this list. Please retry.')
    })
    return () => { mounted = false }
  }, [status, reload])

  function retry() { setTasks(null); setReload((value) => value + 1) }

  function mutate(action: () => Promise<unknown>, update: (tasks: Task[]) => Task[]) {
    if (busy.current) return
    busy.current = true
    setError(null)
    startTransition(async () => {
      try {
        await action()
        setTasks((tasks) => tasks ? update(tasks) : tasks)
      } catch {
        setError('Could not confirm this change. Your item is still shown. Retry the action or refresh the list.')
      } finally { busy.current = false }
    })
  }

  function remove(taskId: string, action: () => Promise<unknown>) {
    mutate(action, (tasks) => tasks.filter((task) => task.id !== taskId))
  }

  return { tasks, error, retry, isPending, mutate, remove }
}
