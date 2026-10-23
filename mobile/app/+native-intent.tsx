import { incomingRoute } from '../lib/incoming-link'

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return incomingRoute(path)
}
