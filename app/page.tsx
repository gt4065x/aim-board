'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { User } from 'firebase/auth'

const FeedClient = dynamic(() => import('./FeedClient'), { ssr: false })

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: () => void
    import('@/lib/firebase/client').then(({ auth }) => {
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        unsub = onAuthStateChanged(auth, (u) => {
          if (u) {
            setUser(u)
            setLoading(false)
          } else {
            router.replace('/auth')
          }
        })
      })
    })
    return () => { unsub?.() }
  }, [router])

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg1)', color: 'var(--text1)' }}>
        <p>Loading session...</p>
      </div>
    )
  }

  return <FeedClient user={user} />
}