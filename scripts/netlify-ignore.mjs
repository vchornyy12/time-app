import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export function shouldIgnoreBuild(cached, current, diff = (from, to) =>
  spawnSync('git', ['diff', '--quiet', from, to, '--', '.', ':!mobile'], { stdio: 'ignore' }).status) {
  // Manual deploys may have no cached Git reference. A clean checkout alone is
  // not evidence that the release is unchanged: compare two real commits only.
  if (![cached, current].every(value => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value))) return false
  return diff(cached, current) === 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const ignore = shouldIgnoreBuild(process.env.CACHED_COMMIT_REF, process.env.COMMIT_REF)
  console.log(ignore ? 'Skipping: no changes outside mobile.' : 'Building: web changes or no reliable cached commit comparison.')
  process.exit(ignore ? 0 : 1)
}
