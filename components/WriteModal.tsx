'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types'
import { useToast } from './Toast'

interface Props {
  userId: string
  onClose: () => void
  onPosted: () => void | Promise<void>
}

const CATEGORY_ITEMS: Array<{ key: Category; label: string; icon: string }> = [
  { key: 'free', label: '자유', icon: '💬' },
  { key: 'qa', label: 'Q&A', icon: '❓' },
  { key: 'study', label: '스터디', icon: '📚' },
  { key: 'career', label: '취업', icon: '💼' },
  { key: 'notice', label: '공지', icon: '📢' },
  { key: 'resource', label: '자료', icon: '📎' },
  { key: 'event', label: '이벤트', icon: '🎉' },
]

const LANGUAGE_ITEMS: Array<{
  key: 'ko' | 'en' | 'zh'
  label: string
  short: string
}> = [
    { key: 'ko', label: '한국어', short: 'KR' },
    { key: 'en', label: 'English', short: 'US' },
    { key: 'zh', label: '中文', short: 'CN' },
  ]

export default function WriteModal({ userId, onClose, onPosted }: Props) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [category, setCategory] = useState<Category>('free')
  const [language, setLanguage] = useState<'ko' | 'en' | 'zh'>('ko')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!title.trim()) {
      showToast('⚠️', '제목을 입력해주세요')
      return
    }

    if (!body.trim()) {
      showToast('⚠️', '내용을 입력해주세요')
      return
    }

    setLoading(true)

    const insertRow = {
      user_id: userId,
      title: title.trim(),
      body: body.trim(),
      category,
      language,
      pinned: false,
    }

    const { error } = await (supabase as any)
      .from('posts')
      .insert([insertRow])

    setLoading(false)

    if (error) {
      console.error('post insert error:', error)
      showToast('❌', error.message)
      return
    }

    showToast('✅', '게시글이 등록되었습니다')
    await onPosted()
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="write-modal" onClick={(e) => e.stopPropagation()}>
        <div className="write-header">
          <div>
            <div className="write-title">새 글 작성</div>
            <div className="write-subtitle">생각과 정보를 자유롭게 나눠보세요</div>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="write-section">
          <div className="section-label">카테고리</div>
          <div className="pill-row">
            {CATEGORY_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`cat-pill ${category === item.key ? 'selected' : ''}`}
                onClick={() => setCategory(item.key)}
              >
                <span className="pill-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="write-section">
          <div className="section-label">언어</div>
          <div className="pill-row">
            {LANGUAGE_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`cat-pill ${language === item.key ? 'selected' : ''}`}
                onClick={() => setLanguage(item.key)}
              >
                <span className="pill-flag">{item.short}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-field">
          <label htmlFor="post-title" className="field-label">
            제목
          </label>
          <input
            id="post-title"
            name="post-title"
            className="field-input"
            type="text"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="modal-field">
          <label htmlFor="post-body" className="field-label">
            내용
          </label>
          <textarea
            id="post-body"
            name="post-body"
            className="field-textarea"
            placeholder="내용을 입력하세요"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
          />
        </div>

        <div className="write-footer">
          <div className="write-tip">
            공개 커뮤니티에 게시됩니다. 서로를 존중하는 표현을 사용해주세요.
          </div>

          <div className="write-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              취소
            </button>
            <button
              type="button"
              className="btn-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '등록 중...' : '게시하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}