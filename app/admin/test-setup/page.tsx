'use client'

import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase/client'
import { doc, updateDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'

export default function TestSetup() {
  const [status, setStatus] = useState('Initializing...')
  const router = useRouter()

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setStatus('Please login first.')
        return
      }
      try {
        await updateDoc(doc(db, 'profiles', user.uid), { role: 'admin' })
        setStatus('Success! You are now an admin. Redirecting...')
        setTimeout(() => router.push('/admin'), 2000)
      } catch (err: any) {
        setStatus('Error: ' + err.message)
      }
    })
    return () => unsub()
  }, [router])

  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Admin Test Setup</h1>
      <p>{status}</p>
    </div>
  )
}
