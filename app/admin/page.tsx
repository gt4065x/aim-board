'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase/client'
import { 
  collection, query, getDocs, doc, deleteDoc, getDoc,
  orderBy, limit
} from 'firebase/firestore'
import { Profile, Post } from '@/lib/types'
import { useToast } from '@/components/Toast'
import { adminUpdateUserPassword, adminCreateUser } from './actions'

export default function AdminPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [tab, setTab] = useState<'users' | 'posts' | 'batch'>('users')

  // User Management
  const [users, setUsers] = useState<Profile[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({})
  
  // Post Moderation
  const [posts, setPosts] = useState<Post[]>([])

  // Batch Registration
  const [batchData, setBatchData] = useState('')
  const [isBatching, setIsBatching] = useState(false)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/auth')
        return
      }
      const snap = await getDoc(doc(db, 'profiles', user.uid))
      const profile = snap.data() as Profile
      if (profile?.role !== 'admin') {
        showToast('⚠️', '관리자 전용 페이지입니다.')
        router.push('/')
        return
      }
      setIsAdmin(true)
      setLoading(false)
      fetchUsers()
      fetchPosts()
    })
    return () => unsub()
  }, [])

  async function fetchUsers() {
    const snap = await getDocs(collection(db, 'profiles'))
    const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Profile))
    setUsers(list)
  }

  async function fetchPosts() {
    const q = query(collection(db, 'posts'), orderBy('created_at', 'desc'), limit(100))
    const snap = await getDocs(q)
    const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Post))
    setPosts(list)
  }

  // --- Actions ---

  async function handleSetPassword(uid: string) {
    const newPass = passwordInputs[uid]
    if (!newPass || newPass.length < 6) {
      showToast('⚠️', '비밀번호를 6자 이상 입력해주세요.')
      return
    }

    try {
      const res = await adminUpdateUserPassword(uid, newPass)
      if (res.success) {
        showToast('✅', '비밀번호가 성공적으로 변경되었습니다.')
        setPasswordInputs(prev => ({ ...prev, [uid]: '' }))
      } else {
        showToast('❌', res.error || '변경 실패')
      }
    } catch (err: any) {
      showToast('❌', err.message)
    }
  }

  async function handleDeletePost(postId: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await deleteDoc(doc(db, 'posts', postId))
      showToast('✅', '삭제되었습니다.')
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (err: any) {
      showToast('❌', err.message)
    }
  }

  async function handleBatchRegister() {
    const lines = batchData.split('\n').filter(l => l.trim())
    if (lines.length === 0) return

    setIsBatching(true)
    let success = 0
    let failed = 0

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim())
      if (parts.length < 2) {
        failed++
        continue
      }
      const [email, username] = parts
      try {
        const res = await adminCreateUser(email, username)
        if (res.success) success++
        else failed++
      } catch (err) {
        failed++
      }
    }

    showToast('📊', `등록 완료 (성공: ${success}, 실패: ${failed})`)
    setIsBatching(false)
    setBatchData('')
    fetchUsers()
  }

  if (loading) return <div className="admin-loading">Checking permissions...</div>

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-logo" onClick={() => router.push('/')}>
          <span className="logo-icon">🤖</span>
          <strong>Admin Console</strong>
        </div>
        <nav className="admin-nav">
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button>
          <button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>Moderation</button>
          <button className={tab === 'batch' ? 'active' : ''} onClick={() => setTab('batch')}>Batch</button>
        </nav>
      </header>

      <main className="admin-content">
        {tab === 'users' && (
          <div className="admin-section">
            <h2 className="section-title">User Management</h2>
            <div className="admin-search-bar">
              <input 
                type="text" 
                placeholder="Search user by name..." 
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Change Password</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="user-info">
                          <span className="user-flag">{u.flag}</span>
                          <div className="user-name">{u.username}</div>
                        </div>
                      </td>
                      <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                      <td>
                        <div className="inline-action">
                          <input 
                            type="password" 
                            placeholder="New PWD" 
                            className="inline-input"
                            value={passwordInputs[u.id] || ''}
                            onChange={(e) => setPasswordInputs(p => ({ ...p, [u.id]: e.target.value }))}
                          />
                          <button className="btn-small brand" onClick={() => handleSetPassword(u.id)}>Set</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'posts' && (
          <div className="admin-section">
            <h2 className="section-title">Content Moderation</h2>
            <div className="post-mod-list">
              {posts.length === 0 ? <p>No posts found.</p> : posts.map(p => (
                <div key={p.id} className="post-mod-item">
                  <div className="post-mod-info">
                    <span className="post-mod-cat">[{p.category}]</span>
                    <span className="post-mod-title">{p.title}</span>
                  </div>
                  <button className="btn-delete" onClick={() => handleDeletePost(p.id)}>Delete</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'batch' && (
          <div className="admin-section">
            <h2 className="section-title">Batch User Registration</h2>
            <p className="section-desc">
              Enter one user per line: <code>email, username</code><br/>
              <em>Initial password for all users will be: <strong>woosong1234</strong></em>
            </p>
            <textarea 
              className="batch-textarea"
              placeholder="student1@woosong.org, 홍길동&#10;student2@woosong.org, Alex Zhang"
              value={batchData}
              onChange={(e) => setBatchData(e.target.value)}
              disabled={isBatching}
            />
            <button 
              className="btn-submit" 
              onClick={handleBatchRegister}
              disabled={isBatching || !batchData.trim()}
            >
              {isBatching ? 'Processing...' : 'Run Batch Import'}
            </button>
          </div>
        )}
      </main>

      <style jsx>{`
        .admin-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #1e293b;
        }
        .admin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          height: 70px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
          position: sticky; top: 0; z-index: 10;
        }
        .admin-logo { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .admin-nav { display: flex; gap: 10px; }
        .admin-nav button {
          padding: 8px 16px; border-radius: 8px; border: none; background: transparent;
          color: #64748b; cursor: pointer; font-weight: 500;
        }
        .admin-nav button.active { background: #3b82f6; color: white; }
        .admin-content { max-width: 1000px; margin: 40px auto; padding: 0 20px; }
        .admin-section {
          background: white; border: 1px solid #e2e8f0; border-radius: 16px;
          padding: 24px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .section-title { margin-bottom: 20px; font-size: 1.5rem; font-weight: 700; }
        .admin-search-bar { margin-bottom: 20px; }
        .admin-search-bar input {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          border: 1px solid #cbd5e1; background: #f1f5f9;
        }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { text-align: left; padding: 12px; border-bottom: 2px solid #f1f5f9; color: #94a3b8; font-size: 0.85rem; }
        .admin-table td { padding: 16px 12px; border-bottom: 1px solid #f1f5f9; }
        .user-info { display: flex; align-items: center; gap: 12px; }
        .user-name { font-weight: 600; }
        .role-badge { padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
        .role-badge.admin { background: #fee2e2; color: #ef4444; }
        .role-badge.student { background: #e0f2fe; color: #0ea5e9; }
        .inline-action { display: flex; gap: 8px; }
        .inline-input {
          padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1;
          font-size: 0.85rem; width: 120px;
        }
        .btn-small {
          padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0;
          background: #f8fafc; color: #475569; font-size: 0.8rem; cursor: pointer;
        }
        .btn-small.brand { background: #3b82f6; color: white; border: none; }
        .post-mod-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px; background: #f1f5f9; border-radius: 10px; margin-bottom: 10px;
        }
        .btn-delete { padding: 6px 14px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; }
        .batch-textarea {
          width: 100%; height: 200px; padding: 16px; border-radius: 12px;
          border: 1px solid #cbd5e1; background: #f1f5f9; font-family: monospace; margin: 16px 0;
        }
        .btn-submit {
          padding: 12px 24px; background: #3b82f6; color: white; border: none;
          border-radius: 10px; font-weight: 600; cursor: pointer; width: 100%;
        }
        .admin-loading { height: 100vh; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
      `}</style>
    </div>
  )
}
