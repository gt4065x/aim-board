'use client'

import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { db, auth } from '@/lib/firebase/client'
import type { Profile, Language } from '@/lib/types'

interface Props {
  profile: Profile
  onClose: () => void
  onSaved: (updated: Profile) => void
}

const FLAGS = [
  { emoji: '🇰🇷', label: '한국' },
  { emoji: '🇨🇳', label: '中国' },
  { emoji: '🇺🇸', label: 'USA' },
  { emoji: '🇻🇳', label: 'Vietnam' },
  { emoji: '🇯🇵', label: '日本' },
  { emoji: '🌍', label: '기타' },
]

function flagToLang(flag: string): Language {
  if (flag === '🇺🇸') return 'en'
  if (flag === '🇨🇳') return 'zh'
  return 'ko'
}

export default function ProfileSettingsModal({ profile, onClose, onSaved }: Props) {
  const [username, setUsername] = useState(profile.username)
  const [flag, setFlag] = useState(profile.flag)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [tab, setTab] = useState<'info' | 'password'>('info')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSaveInfo() {
    if (!username.trim()) { setError('닉네임을 입력해주세요.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const updated: Profile = {
        ...profile,
        username: username.trim(),
        flag,
        language: flagToLang(flag),
        avatar_letter: username.trim()[0].toUpperCase(),
      }
      await updateDoc(doc(db, 'profiles', profile.id), {
        username: updated.username,
        flag: updated.flag,
        language: updated.language,
        avatar_letter: updated.avatar_letter,
      })
      setSuccess('저장되었습니다.')
      onSaved(updated)
    } catch (e: any) {
      setError(e.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (!currentPw) { setError('현재 비밀번호를 입력해주세요.'); return }
    if (newPw.length < 8) { setError('새 비밀번호는 8자 이상이어야 합니다.'); return }
    if (newPw !== confirmPw) { setError('새 비밀번호가 일치하지 않습니다.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const user = auth.currentUser!
      const credential = EmailAuthProvider.credential(user.email!, currentPw)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPw)
      setSuccess('비밀번호가 변경되었습니다.')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (e: any) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError('현재 비밀번호가 올바르지 않습니다.')
      } else {
        setError(e.message || '비밀번호 변경 중 오류가 발생했습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">⚙️ 프로필 설정</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 아바타 미리보기 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 16px' }}>
          <div className={`post-avatar ${flag === '🇰🇷' ? 'av-ko' : flag === '🇺🇸' ? 'av-en' : flag === '🇨🇳' ? 'av-zh' : ''}`}
            style={{ width: 48, height: 48, fontSize: 20, flexShrink: 0, ...(flag === '🌍' || flag === '🇻🇳' || flag === '🇯🇵' ? { background: 'linear-gradient(135deg,#f77f00,#d62828)' } : {}) }}>
            {username.trim()[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{username || '닉네임'}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{flag} · {profile.role === 'professor' ? '교수' : '학생'}</div>
          </div>
        </div>

        {/* 탭 */}
        <div className="auth-tabs" style={{ marginBottom: 16 }}>
          <button className={`auth-tab ${tab === 'info' ? 'active' : ''}`} onClick={() => { setTab('info'); setError(''); setSuccess('') }}>기본 정보</button>
          <button className={`auth-tab ${tab === 'password' ? 'active' : ''}`} onClick={() => { setTab('password'); setError(''); setSuccess('') }}>비밀번호 변경</button>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#16a34a', marginBottom: 12 }}>{success}</div>}

        {tab === 'info' && (
          <>
            <div className="modal-field">
              <label className="field-label">닉네임</label>
              <input className="field-input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="닉네임 입력" />
            </div>
            <div className="modal-field">
              <label className="field-label">국가</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {FLAGS.map((f) => (
                  <button key={f.emoji} type="button"
                    className={`cat-pill ${flag === f.emoji ? 'selected' : ''}`}
                    onClick={() => setFlag(f.emoji)}>
                    {f.emoji} {f.label}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-submit" style={{ width: '100%', marginTop: 8, padding: '12px' }} onClick={handleSaveInfo} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </>
        )}

        {tab === 'password' && (
          <>
            <div className="modal-field">
              <label className="field-label">현재 비밀번호</label>
              <input className="field-input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="현재 비밀번호" autoComplete="current-password" />
            </div>
            <div className="modal-field">
              <label className="field-label">새 비밀번호</label>
              <input className="field-input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="8자 이상" autoComplete="new-password" />
            </div>
            <div className="modal-field">
              <label className="field-label">새 비밀번호 확인</label>
              <input className="field-input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="비밀번호 재입력" autoComplete="new-password" />
            </div>
            <button className="btn-submit" style={{ width: '100%', marginTop: 8, padding: '12px' }} onClick={handleChangePassword} disabled={saving}>
              {saving ? '변경 중...' : '비밀번호 변경'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
