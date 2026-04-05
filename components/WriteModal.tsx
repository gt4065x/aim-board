'use client'

import { useState } from 'react'
import { Category } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useToast } from './Toast'

interface Props {
  userId: string
  onClose: () => void
  onPosted: () => void
}

export default function WriteModal({ userId, onClose, onPosted }: Props) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<Category>('free')
  const [language, setLanguage] = useState('ko')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) {
      showToast('⚠️', '제목과 내용을 입력해주세요')
      return
    }

    setLoading(true)

    const insertRow = {
      user_id: userId,
      title: title.trim(),
      body: body.trim(),
      category,
      language,
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
    onPosted()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="write-modal" onClick={(e) => e.stopPropagation()}>
        <div className="write-header">
          <h2>새 글 작성</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="write-body">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            <option value="free">자유</option>
            <option value="qa">Q&A</option>
            <option value="study">스터디</option>
            <option value="career">취업</option>
            <option value="notice">공지</option>
            <option value="resource">자료</option>
            <option value="event">이벤트</option>
          </select>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>

          <input
            type="text"
            placeholder="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            placeholder="내용을 입력하세요"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
          />

          <div className="write-actions">
            <button onClick={onClose} disabled={loading}>
              취소
            </button>
            <button onClick={handleSubmit} disabled={loading}>
              {loading ? '등록 중...' : '게시하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}