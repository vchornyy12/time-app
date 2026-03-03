import { redirect } from 'next/navigation'

// Root path redirects to inbox (middleware handles auth guard)
export default function RootPage() {
  redirect('/inbox')
}
