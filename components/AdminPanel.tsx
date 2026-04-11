'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { getIdToken } from 'firebase/auth'
import { auth, db } from '@/lib/firebase/client'
import type { Profile, Role } from '@/lib/types'

const ROLES: Role[] = ['student', 'professor', 'staff', 'admin']

const ROLE_LABELS: Record<Role, string> = {
  student: '학생',
  professor: '교수',
  staff: '스탭',
  admin: '어드민',
}

const ROLE_COLORS: Record<Role, string> = {
  student: 'var(--text3)',
  professor: '#4f8ef7',
  staff: '#f7a44f',
  admin: '#e05c5c',
}

interface Props {
  onClose: () => void
}

export default function AdminPanel({ onClose }: Props) {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'profiles'), orderBy('created_at', 'desc'))
    getDocs(q).then((snap) => {
      setUsers(snap.docs.map((d) => d.data() as Profile))
      setLoading(false)
    })
  }, [])

  async function handleRoleChange(targetUserId: string, role: Role) {
    setUpdating(targetUserId)
    setMessage(null)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error('로그인 상태가 아닙니다.')
      const idToken = await getIdToken(currentUser)

      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ targetUserId, role }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '역할 변경 실패')

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, role } : u))
      )
      setMessage({ type: 'ok', text: '역할이 변경되었습니다.' })
    } catch (err: any) {
      setMessage({ type: 'err', text: err.message ?? '오류가 발생했습니다.' })
    } finally {
      setUpdating(null)
    }
  }

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--surface1)', border: '1px solid var(--border1)',
          borderRadius: 16, width: '100%', maxWidth: 640,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>
              🛡️ 어드민 패널
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              유저 역할 관리
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
              color: 'var(--text2)', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* 검색 */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border1)' }}>
          <input
            type="text"
            placeholder="이름 또는 UID로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--border2)', background: 'var(--surface2)',
              color: 'var(--text1)', fontSize: 14, boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 알림 메시지 */}
        {message && (
          <div style={{
            margin: '8px 24px 0', padding: '8px 12px', borderRadius: 8, fontSize: 13,
            background: message.type === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(224,92,92,0.12)',
            color: message.type === 'ok' ? '#22c55e' : '#e05c5c',
            border: `1px solid ${message.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(224,92,92,0.3)'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* 유저 목록 */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 24px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
              불러오는 중...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
              검색 결과가 없습니다.
            </div>
          ) : (
            filtered.map((user) => (
              <div
                key={user.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: '1px solid var(--border1)',
                }}
              >
                {/* 아바타 */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--surface2)', border: '1px solid var(--border2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, color: 'var(--text1)', flexShrink: 0,
                }}>
                  {user.avatar_letter}
                </div>

                {/* 이름 + UID */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text1)' }}>
                    {user.flag} {user.username}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.id}
                  </div>
                </div>

                {/* 역할 선택 */}
                <select
                  value={user.role}
                  disabled={updating === user.id}
                  onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                  style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 13,
                    border: '1px solid var(--border2)', background: 'var(--surface2)',
                    color: ROLE_COLORS[user.role], fontWeight: 600,
                    cursor: 'pointer', flexShrink: 0,
                    opacity: updating === user.id ? 0.5 : 1,
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} style={{ color: ROLE_COLORS[r] }}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          padding: '12px 24px', borderTop: '1px solid var(--border1)',
          fontSize: 12, color: 'var(--text3)',
        }}>
          총 {users.length}명 · 표시 {filtered.length}명
        </div>
      </div>
    </div>
  )
}
