'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase/client'
import { onAuthStateChanged, User } from 'firebase/auth'
import FeedClient from './FeedClient'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u)
        setLoading(false)
      } else {
        router.replace('/auth')
      }
    })
    return () => unsub()
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