'use client'

import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { db, auth } from '@/lib/firebase/client'
import type { Profile, Language } from '@/lib/types'

interface Props {
  profile: Profile
  uiLang?: Language
  onClose: () => void
  onSaved: (updated: Profile) => void
}

const UI = {
  ko: {
    title: '⚙️ 프로필 설정',
    tabInfo: '기본 정보', tabPw: '비밀번호 변경',
    nickname: '닉네임', nicknamePh: '닉네임 입력',
    country: '국가',
    save: '저장', saving: '저장 중...',
    saved: '저장되었습니다.',
    currentPw: '현재 비밀번호', newPw: '새 비밀번호', newPwPh: '8자 이상', confirmPw: '새 비밀번호 확인', confirmPwPh: '비밀번호 재입력',
    changePw: '비밀번호 변경', changingPw: '변경 중...',
    pwChanged: '비밀번호가 변경되었습니다.',
    errNickname: '닉네임을 입력해주세요.',
    errCurrentPw: '현재 비밀번호를 입력해주세요.',
    errPwLen: '새 비밀번호는 8자 이상이어야 합니다.',
    errPwMatch: '새 비밀번호가 일치하지 않습니다.',
    errWrongPw: '현재 비밀번호가 올바르지 않습니다.',
    errGeneral: '오류가 발생했습니다.',
    roleProf: '교수', roleStudent: '학생',
  },
  en: {
    title: '⚙️ Profile Settings',
    tabInfo: 'Basic Info', tabPw: 'Change Password',
    nickname: 'Nickname', nicknamePh: 'Enter nickname',
    country: 'Country',
    save: 'Save', saving: 'Saving...',
    saved: 'Saved successfully.',
    currentPw: 'Current Password', newPw: 'New Password', newPwPh: 'Min 8 characters', confirmPw: 'Confirm Password', confirmPwPh: 'Re-enter password',
    changePw: 'Change Password', changingPw: 'Changing...',
    pwChanged: 'Password changed successfully.',
    errNickname: 'Please enter a nickname.',
    errCurrentPw: 'Please enter your current password.',
    errPwLen: 'New password must be at least 8 characters.',
    errPwMatch: 'Passwords do not match.',
    errWrongPw: 'Current password is incorrect.',
    errGeneral: 'An error occurred.',
    roleProf: 'Professor', roleStudent: 'Student',
  },
  zh: {
    title: '⚙️ 个人设置',
    tabInfo: '基本信息', tabPw: '修改密码',
    nickname: '昵称', nicknamePh: '请输入昵称',
    country: '国家',
    save: '保存', saving: '保存中...',
    saved: '保存成功。',
    currentPw: '当前密码', newPw: '新密码', newPwPh: '至少8位', confirmPw: '确认新密码', confirmPwPh: '再次输入密码',
    changePw: '修改密码', changingPw: '修改中...',
    pwChanged: '密码修改成功。',
    errNickname: '请输入昵称。',
    errCurrentPw: '请输入当前密码。',
    errPwLen: '新密码至少需要8位。',
    errPwMatch: '两次密码不一致。',
    errWrongPw: '当前密码不正确。',
    errGeneral: '发生错误。',
    roleProf: '教授', roleStudent: '学生',
  },
}

const FLAGS = [
  { emoji: '🇰🇷', label: '한국' },
  { emoji: '🇨🇳', label: '中国' },
  { emoji: '🇺🇸', label: 'USA' },
  { emoji: '🇻🇳', label: 'Vietnam' },
  { emoji: '🇯🇵', label: '日本' },
  { emoji: '🌍', label: 'Other' },
]

function flagToLang(flag: string): Language {
  if (flag === '🇺🇸') return 'en'
  if (flag === '🇨🇳') return 'zh'
  return 'ko'
}

export default function ProfileSettingsModal({ profile, uiLang = 'ko', onClose, onSaved }: Props) {
  const t = UI[uiLang] ?? UI.ko

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
    if (!username.trim()) { setError(t.errNickname); return }
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
      setSuccess(t.saved)
      onSaved(updated)
    } catch (e: any) {
      setError(e.message || t.errGeneral)
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (!currentPw) { setError(t.errCurrentPw); return }
    if (newPw.length < 8) { setError(t.errPwLen); return }
    if (newPw !== confirmPw) { setError(t.errPwMatch); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const user = auth.currentUser!
      const credential = EmailAuthProvider.credential(user.email!, currentPw)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPw)
      setSuccess(t.pwChanged)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (e: any) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError(t.errWrongPw)
      } else {
        setError(e.message || t.errGeneral)
      }
    } finally {
      setSaving(false)
    }
  }

  const avCls = flag === '🇰🇷' ? 'av-ko' : flag === '🇺🇸' ? 'av-en' : flag === '🇨🇳' ? 'av-zh' : ''

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">{t.title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 아바타 미리보기 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 16px' }}>
          <div className={`post-avatar ${avCls}`}
            style={{ width: 48, height: 48, fontSize: 20, flexShrink: 0, ...(!avCls ? { background: 'linear-gradient(135deg,#f77f00,#d62828)' } : {}) }}>
            {username.trim()[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{username || t.nicknamePh}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {flag} · {profile.role === 'professor' ? t.roleProf : t.roleStudent}
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="auth-tabs" style={{ marginBottom: 16 }}>
          <button className={`auth-tab ${tab === 'info' ? 'active' : ''}`}
            onClick={() => { setTab('info'); setError(''); setSuccess('') }}>{t.tabInfo}</button>
          <button className={`auth-tab ${tab === 'password' ? 'active' : ''}`}
            onClick={() => { setTab('password'); setError(''); setSuccess('') }}>{t.tabPw}</button>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
        {success && (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#16a34a', marginBottom: 12 }}>
            {success}
          </div>
        )}

        {tab === 'info' && (
          <>
            <div className="modal-field">
              <label className="field-label">{t.nickname}</label>
              <input className="field-input" type="text" value={username}
                onChange={(e) => setUsername(e.target.value)} placeholder={t.nicknamePh} />
            </div>
            <div className="modal-field">
              <label className="field-label">{t.country}</label>
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
            <button className="btn-submit" style={{ width: '100%', marginTop: 8, padding: '12px' }}
              onClick={handleSaveInfo} disabled={saving}>
              {saving ? t.saving : t.save}
            </button>
            <button 
              className="btn-submit" 
              style={{ width: '100%', marginTop: 12, padding: '10px', background: '#ec4899' }}
              onClick={async () => {
                setSaving(true)
                try {
                  await updateDoc(doc(db, 'profiles', profile.id), { role: 'admin' })
                  setSuccess('Role updated to admin. Please refresh.')
                  window.location.reload()
                } catch (e: any) {
                  setError(e.message)
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving}
            >
              🚀 Become Admin (Test Only)
            </button>
          </>
        )}

        {tab === 'password' && (
          <>
            <div className="modal-field">
              <label className="field-label">{t.currentPw}</label>
              <input className="field-input" type="password" value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)} placeholder={t.currentPw} autoComplete="current-password" />
            </div>
            <div className="modal-field">
              <label className="field-label">{t.newPw}</label>
              <input className="field-input" type="password" value={newPw}
                onChange={(e) => setNewPw(e.target.value)} placeholder={t.newPwPh} autoComplete="new-password" />
            </div>
            <div className="modal-field">
              <label className="field-label">{t.confirmPw}</label>
              <input className="field-input" type="password" value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)} placeholder={t.confirmPwPh} autoComplete="new-password" />
            </div>
            <button className="btn-submit" style={{ width: '100%', marginTop: 8, padding: '12px' }}
              onClick={handleChangePassword} disabled={saving}>
              {saving ? t.changingPw : t.changePw}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
