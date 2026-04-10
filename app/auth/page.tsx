'use client'
export const dynamic = 'force-dynamic';
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase/client'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import type { FormEvent } from 'react'

export default function AuthPage() {
  const router = useRouter()

  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [flag, setFlag] = useState('🇰🇷')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const flags = [
    { emoji: '🇰🇷', label: '한국', lang: 'ko' },
    { emoji: '🇨🇳', label: '中国', lang: 'zh' },
    { emoji: '🇺🇸', label: 'USA', lang: 'en' },
    { emoji: '🇻🇳', label: 'Vietnam', lang: 'en' },
    { emoji: '🇯🇵', label: '日本', lang: 'en' },
    { emoji: '🌍', label: '기타', lang: 'ko' },
  ]

  function flagToLang(f: string) {
    return flags.find((x) => x.emoji === f)?.lang ?? 'ko'
  }

  // 🔥 로그인
  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.replace('/')
      router.refresh()
    } catch (err: any) {
      console.error('login error:', err)
      setError(err.message || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 🔥 회원가입
  async function handleSignup(e: FormEvent) {
    e.preventDefault()

    if (!username.trim()) {
      setError('이름을 입력해주세요')
      return
    }

    setLoading(true)
    setError('')

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Firestore의 profiles 컬렉션에 유저 메타데이터 저장
      await setDoc(doc(db, 'profiles', user.uid), {
        id: user.uid,
        username: username.trim(),
        flag,
        language: flagToLang(flag),
        avatar_letter: username.trim()[0].toUpperCase(),
        role: 'student',
        created_at: new Date().toISOString()
      })

      router.replace('/')
      router.refresh()
    } catch (err: any) {
      console.error('signup error:', err)
      setError(err.message || '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🤖</div>
          <div>
            AI경영학과
            <span
              style={{
                display: 'block',
                fontFamily: 'DM Mono, monospace',
                fontSize: 10,
                letterSpacing: 2,
                color: 'var(--text3)',
                textTransform: 'uppercase',
              }}
            >
              Woosong · Community
            </span>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setTab('login')
              setError('')
            }}
          >
            Login / 로그인
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setTab('signup')
              setError('')
            }}
          >
            Sign Up / 회원가입
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={tab === 'login' ? handleLogin : handleSignup}>
          {tab === 'signup' && (
            <>
              <div className="modal-field">
                <label className="field-label">Name (Nickname) / 이름 (닉네임)</label>
                <input
                  id="username"
                  name="username"
                  className="field-input"
                  type="text"
                  placeholder="홍길동 / Zhang Wei / Alex"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="modal-field">
                <label className="field-label">Country / 국가</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {flags.map((f) => (
                    <button
                      key={f.emoji}
                      type="button"
                      className={`cat-pill ${flag === f.emoji ? 'selected' : ''
                        }`}
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
            <label className="field-label">Email / 이메일</label>
            <input
              id="email"
              name="email"
              className="field-input"
              type="email"
              placeholder="student@woosong.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="modal-field">
            <label className="field-label">Password / 비밀번호</label>
            <input
              id="password"
              name="password"
              className="field-input"
              type="password"
              placeholder="8+ characters / 8자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
            {loading
              ? 'Processing... / 처리 중...'
              : tab === 'login'
                ? 'Login / 로그인'
                : 'Join Now / 가입하기 🚀'}
          </button>
        </form>
      </div>
    </div>
  )
}