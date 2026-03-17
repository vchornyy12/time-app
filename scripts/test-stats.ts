/**
 * Diagnostic script — tests public.get_public_stats() RPC with the anon key.
 * Run: npx tsx scripts/test-stats.ts
 *
 * This uses the same credentials and code path as the landing page,
 * so if it works here, the page will show real data (after cache expires).
 */

import { config } from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: path.resolve(process.cwd(), '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

console.log('🔗  Supabase URL:', url)
console.log('🔑  Using anon key (same as landing page)\n')

const supabase = createClient(url, anonKey)

async function run() {
  console.log('── Test 1: raw RPC call ─────────────────────────────────')
  const { data, error } = await supabase.rpc('get_public_stats')
  console.log('data :', data)
  console.log('error:', error)

  if (error) {
    console.log('\n❌  RPC failed. Common fixes:')
    console.log('   Run this in Supabase SQL editor:')
    console.log('   GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;\n')
  } else {
    console.log('\n✅  RPC succeeded!')
    console.log(`   user_count : ${data?.user_count}`)
    console.log(`   task_count : ${data?.task_count}`)
    console.log('\n   If the page still shows fallback values, the Next.js cache')
    console.log('   is stale (1h TTL). Restart the dev server to bust it.')
  }
}

run().catch(console.error)
