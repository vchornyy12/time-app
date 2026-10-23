import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSession } from './session'
import { fetchTaskPage, taskCursor, TASK_PAGE_SIZE, type TaskCursor, type TaskStatus, type TaskSummary } from './tasks'

export function useTaskList(status: TaskStatus, context: string | null = null, allDates = false) {
  const userId = useSession()?.user.id
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const cursor = useRef<{ after: TaskCursor | null; more: boolean; day: Date }>({ after: null, more: true, day: new Date() })
  const focused = useRef(false)

  const load = useCallback(async (reset: boolean) => {
    if (!userId || (!reset && (request.current || !cursor.current.more))) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    if (reset) cursor.current = { after: null, more: true, day: new Date() }
    setLoading(true)
    try {
      const page = await fetchTaskPage(userId, status, cursor.current.after, controller.signal, cursor.current.day, context, allDates)
      if (controller.signal.aborted) return
      if (page.length) cursor.current.after = taskCursor(page[page.length - 1], status)
      cursor.current.more = page.length === TASK_PAGE_SIZE
      setTasks(previous => reset ? page : [...new Map([...previous, ...page].map(task => [task.id, task])).values()])
      setError(null)
    } catch {
      if (!controller.signal.aborted) setError('Unable to load tasks. Pull to refresh and try again.')
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false) }
    }
  }, [userId, status, context, allDates])

  const reload = useCallback(() => load(true), [load])
  const loadMore = useCallback(() => load(false), [load])
  useFocusEffect(useCallback(() => {
    focused.current = true
    setTasks([])
    void reload()
    return () => { focused.current = false; request.current?.abort(); request.current = null }
  }, [reload, userId]))
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && focused.current) void reload()
    })
    return () => subscription.remove()
  }, [reload])
  const remove = useCallback((id: string) => {
    request.current?.abort()
    request.current = null
    setLoading(false)
    setTasks(previous => previous.filter(task => task.id !== id))
  }, [])
  return { tasks, loading, error, reload, loadMore, remove, userId: userId ?? '' }
}
