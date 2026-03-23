import { useRef, useState, useEffect } from 'react'

export function useOverflowing<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    function check() {
      const el = ref.current
      if (el) setIsOverflowing(el.scrollWidth > el.clientWidth)
    }
    check()
    const observer = new ResizeObserver(check)
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return { ref, isOverflowing }
}
