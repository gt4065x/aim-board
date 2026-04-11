'use client'

import { useState, useEffect, useRef } from 'react'
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

interface Notif {
  id: string
  type: 'comment' | 'like'
  postId: string
  postTitle: string
  fromUsername: string
  fromFlag: string
  createdAt: string
}

interface UserPost {
  id: string
  title: string
}

interface Props {
  userId: string
  userPosts: UserPost[]
}

function timeAgo(dateStr: string) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function NotificationBell({ userId, userPosts }: Props) {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState<number>(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const val = window.localStorage?.getItem?.(`notif_seen_${userId}`)
    if (val) setLastSeen(parseInt(val))
  }, [userId])
  const profileCache = useRef<Record<string, { username: string; flag: string }>>({})

  async function getProfile(uid: string) {
    if (profileCache.current[uid]) return profileCache.current[uid]
    const snap = await getDoc(doc(db, 'profiles', uid))
    const data = snap.exists()
      ? { username: snap.data().username, flag: snap.data().flag }
      : { username: '알 수 없음', flag: '🌍' }
    profileCache.current[uid] = data
    return data
  }

  useEffect(() => {
    if (userPosts.length === 0) return

    const postMap = Object.fromEntries(userPosts.map(p => [p.id, p.title]))
    const postIds = userPosts.map(p => p.id)
    const unsubs: (() => void)[] = []

    // Firestore 'in' 쿼리는 최대 30개 — 30개씩 청크
    const chunks: string[][] = []
    for (let i = 0; i < postIds.length; i += 30) chunks.push(postIds.slice(i, i + 30))

    chunks.forEach(chunk => {
      // 댓글 알림
      const qComments = query(collection(db, 'comments'), where('post_id', 'in', chunk))
      unsubs.push(onSnapshot(qComments, async snap => {
        for (const d of snap.docs) {
          const data = d.data()
          if (data.user_id === userId) continue
          const profile = await getProfile(data.user_id)
          setNotifs(prev => {
            const key = `c_${d.id}`
            const without = prev.filter(n => n.id !== key)
            return [...without, {
              id: key, type: 'comment' as const,
              postId: data.post_id,
              postTitle: postMap[data.post_id] || '게시글',
              fromUsername: profile.username,
              fromFlag: profile.flag,
              createdAt: data.created_at,
            }].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          })
        }
      }))

      // 좋아요 알림
      const qLikes = query(collection(db, 'likes'), where('post_id', 'in', chunk))
      unsubs.push(onSnapshot(qLikes, async snap => {
        for (const d of snap.docs) {
          const data = d.data()
          if (data.user_id === userId) continue
          const profile = await getProfile(data.user_id)
          setNotifs(prev => {
            const key = `l_${d.id}`
            const without = prev.filter(n => n.id !== key)
            return [...without, {
              id: key, type: 'like' as const,
              postId: data.post_id,
              postTitle: postMap[data.post_id] || '게시글',
              fromUsername: profile.username,
              fromFlag: profile.flag,
              createdAt: data.created_at,
            }].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          })
        }
      }))
    })

    return () => unsubs.forEach(u => u())
  }, [userId, userPosts])

  // 바깥 클릭 시 팝업 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unread = notifs.filter(n => new Date(n.createdAt).getTime() > lastSeen).length

  function handleToggle() {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen && unread > 0) {
      const now = Date.now()
      setLastSeen(now)
      window.localStorage?.setItem?.(`notif_seen_${userId}`, String(now))
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        className="notif-btn"
        onClick={handleToggle}
        style={{ cursor: 'pointer', position: 'relative', userSelect: 'none' }}
        title="알림"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: '#ef4444', color: '#fff',
            borderRadius: '50%', minWidth: 18, height: 18, padding: '0 3px',
            fontSize: 10, fontWeight: 700, lineHeight: '18px', textAlign: 'center',
            border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 300, maxHeight: 380,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          overflow: 'hidden', zIndex: 300,
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            fontWeight: 700, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>🔔 알림</span>
            {notifs.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
                총 {notifs.length}개
              </span>
            )}
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 316 }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
                아직 알림이 없습니다
              </div>
            ) : (
              notifs.slice(0, 30).map(n => {
                const isNew = new Date(n.createdAt).getTime() > lastSeen
                return (
                  <div key={n.id} style={{
                    padding: '11px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: isNew ? 'rgba(99,102,241,0.08)' : 'transparent',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                      {n.type === 'comment' ? '💬' : '❤️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text1)', lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 600 }}>{n.fromFlag} {n.fromUsername}</span>
                        {'님이 '}
                        {n.type === 'comment' ? '댓글을 달았습니다' : '좋아요를 눌렀습니다'}
                      </div>
                      <div style={{
                        fontSize: 11.5, color: 'var(--text3)', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        📝 {n.postTitle}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>
                        {timeAgo(n.createdAt)}
                      </div>
                    </div>
                    {isNew && (
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: '#6366f1', flexShrink: 0, marginTop: 5
                      }} />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
