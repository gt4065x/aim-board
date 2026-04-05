'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [flag, setFlag] = useState('🇰🇷')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const flags = [
    { emoji: '🇰🇷', label: '한국' },
    { emoji: '🇨🇳', label: '中国' },
    { emoji: '🇺🇸', label: 'USA' },
    { emoji: '🇻🇳', label: 'Vietnam' },
    { emoji: '🇯🇵', label: '日本' },
    { emoji: '🌍', label: '기타' },
  ]

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      router.replace('/')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) { setError('이름을 입력해주세요'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.trim(),
          flag,
          avatar_letter: username.trim()[0].toUpperCase(),
        },
      },
    })
    if (error) {
      setError(error.message)
    } else {
      router.replace('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🤖</div>
          <div>
            AI경영학과
            <span style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: 2, color: 'var(--text3)', textTransform: 'uppercase' }}>
              Woosong · Community
            </span>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError('') }}>
            로그인
          </button>
          <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setError('') }}>
            회원가입
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={tab === 'login' ? handleLogin : handleSignup}>
          {tab === 'signup' && (
            <>
              <div className="modal-field">
                <label className="field-label">이름 (닉네임)</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="홍길동 / Zhang Wei / Alex"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="modal-field">
                <label className="field-label">국가</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {flags.map(f => (
                    <button
                      key={f.emoji}
                      type="button"
                      className={`cat-pill ${flag === f.emoji ? 'selected' : ''}`}
                      onClick={() => setFlag(f.emoji)}
                    >
                      {f.emoji} {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="modal-field">
            <label className="field-label">이메일</label>
            <input
              className="field-input"
              type="email"
              placeholder="student@woosong.org"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="modal-field">
            <label className="field-label">비밀번호</label>
            <input
              className="field-input"
              type="password"
              placeholder="8자 이상"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="btn-submit"
            style={{ width: '100%', marginTop: 8, padding: '12px' }}
            disabled={loading}
          >
            {loading ? '처리 중...' : tab === 'login' ? '로그인' : '가입하기 🚀'}
          </button>
        </form>
      </div>
    </div>
  )
}
