'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, Language } from '@/lib/types'
import { useToast } from './Toast'

interface Props {
  userId: string
  onClose: () => void
  onPosted: () => void
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'free',     label: '💬 자유' },
  { value: 'qa',       label: '❓ Q&A' },
  { value: 'study',    label: '📚 스터디' },
  { value: 'career',   label: '💼 취업' },
  { value: 'resource', label: '📎 자료' },
  { value: 'event',    label: '🎉 이벤트' },
]

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'ko', label: '🇰🇷 한국어' },
  { value: 'en', label: '🇺🇸 English' },
  { value: 'zh', label: '🇨🇳 中文' },
]

export default function WriteModal({ userId, onClose, onPosted }: Props) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [category, setCategory] = useState<Category>('free')
  const [language, setLanguage] = useState<Language>('ko')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!title.trim() || !body.trim()) {
      showToast('⚠️', '제목과 내용을 입력해주세요')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('posts').insert({
      user_id: userId,
      title: title.trim(),
      body: body.trim(),
      category,
      language,
    })
    setLoading(false)
    if (error) {
      showToast('❌', '게시글 등록에 실패했습니다')
    } else {
      showToast('🚀', '게시글이 등록되었습니다!')
      onPosted()
      onClose()
    }
  }

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">✏️ 새 글 작성</div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-field">
          <label className="field-label">게시판 선택</label>
          <div className="cat-pills">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                className={`cat-pill ${category === c.value ? 'selected' : ''}`}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-field">
          <label className="field-label">작성 언어</label>
          <div className="cat-pills">
            {LANGUAGES.map(l => (
              <button
                key={l.value}
                className={`cat-pill ${language === l.value ? 'selected' : ''}`}
                onClick={() => setLanguage(l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-field">
          <label className="field-label">제목</label>
          <input
            className="field-input"
            type="text"
            placeholder="제목을 입력해주세요"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="modal-field">
          <label className="field-label">내용</label>
          <textarea
            className="field-textarea"
            placeholder="내용을 자유롭게 작성해주세요. 어떤 언어든 괜찮아요 😊"
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0',
          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 4
        }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>🤖 AI 자동 번역 제공</span>
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>다른 언어 학생들을 위해 자동 번역</span>
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>취소</button>
          <button className="btn-submit" onClick={submit} disabled={loading}>
            {loading ? '등록 중...' : '게시하기 🚀'}
          </button>
        </div>
      </div>
    </div>
  )
}
