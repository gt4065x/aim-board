'use client'

import { useState, useRef } from 'react'
import { db } from '@/lib/firebase/client'
import { collection, addDoc } from 'firebase/firestore'
import { Category } from '@/lib/types'
import { useToast } from './Toast'

const TITLE_MAX = 120
const BODY_MAX = 2000

const WRITE_UI = {
  ko: {
    title: '새 글 작성',
    subtitle: '생각과 정보를 자유롭게 나눠보세요',
    category: '카테고리',
    language: '언어',
    titleLabel: '제목',
    titlePlaceholder: '제목을 입력하세요',
    bodyLabel: '내용',
    bodyPlaceholder: '내용을 입력하세요',
    tip: '공개 커뮤니티에 게시됩니다. 서로를 존중하는 표현을 사용해주세요.',
    cancel: '취소',
    submit: '게시하기',
    submitting: '등록 중...',
    warnTitle: '제목을 입력해주세요',
    warnBody: '내용을 입력해주세요',
    warnBodyLong: `내용이 너무 깁니다. 최대 ${BODY_MAX}자까지만 입력 가능합니다.`,
    warnTitleLong: `제목이 너무 깁니다. 최대 ${TITLE_MAX}자까지만 입력 가능합니다.`,
    errTimeout: '네트워크 연결이 지연되고 있습니다. 다시 시도해 주세요.',
    errPermission: '게시 권한이 없습니다. 로그인 상태를 확인해 주세요.',
    errSize: '내용이 너무 커서 저장에 실패했습니다.',
    errLock: '요청이 지연되었습니다. 잠시 후 다시 시도해 주세요.',
    success: '게시글이 등록되었습니다',
  },
  en: {
    title: 'Write a Post',
    subtitle: 'Share your thoughts and information freely',
    category: 'Category',
    language: 'Language',
    titleLabel: 'Title',
    titlePlaceholder: 'Enter a title',
    bodyLabel: 'Content',
    bodyPlaceholder: 'Enter your content',
    tip: 'This will be posted publicly. Please be respectful.',
    cancel: 'Cancel',
    submit: 'Post',
    submitting: 'Posting...',
    warnTitle: 'Please enter a title',
    warnBody: 'Please enter content',
    warnBodyLong: `Content is too long. Maximum ${BODY_MAX} characters allowed.`,
    warnTitleLong: `Title is too long. Maximum ${TITLE_MAX} characters allowed.`,
    errTimeout: 'Network is slow. Please try again.',
    errPermission: 'You do not have permission to post. Please check your login status.',
    errSize: 'Content is too large to save.',
    errLock: 'Request was delayed. Please try again in a moment.',
    success: 'Post published successfully',
  },
  zh: {
    title: '写帖子',
    subtitle: '自由分享你的想法和信息',
    category: '分类',
    language: '语言',
    titleLabel: '标题',
    titlePlaceholder: '请输入标题',
    bodyLabel: '内容',
    bodyPlaceholder: '请输入内容',
    tip: '将公开发布，请互相尊重。',
    cancel: '取消',
    submit: '发布',
    submitting: '发布中...',
    warnTitle: '请输入标题',
    warnBody: '请输入内容',
    warnBodyLong: `内容过长，最多输入 ${BODY_MAX} 个字符。`,
    warnTitleLong: `标题过长，最多输入 ${TITLE_MAX} 个字符。`,
    errTimeout: '网络连接超时，请重试。',
    errPermission: '您没有发布权限，请检查登录状态。',
    errSize: '内容过大，保存失败。',
    errLock: '请求延迟，请稍后再试。',
    success: '帖子发布成功',
  },
}

const CATEGORY_ITEMS: Array<{ key: Category; label: Record<'ko' | 'en' | 'zh', string>; icon: string }> = [
  { key: 'free',     icon: '💬', label: { ko: '자유',     en: 'General',   zh: '自由'   } },
  { key: 'qa',       icon: '❓', label: { ko: 'Q&A',      en: 'Q&A',       zh: 'Q&A'    } },
  { key: 'study',    icon: '📚', label: { ko: '스터디',   en: 'Study',     zh: '学习'   } },
  { key: 'career',   icon: '💼', label: { ko: '취업',     en: 'Career',    zh: '就业'   } },
  { key: 'notice',   icon: '📢', label: { ko: '공지',     en: 'Notice',    zh: '公告'   } },
  { key: 'resource', icon: '📎', label: { ko: '자료',     en: 'Resources', zh: '资料'   } },
  { key: 'event',    icon: '🎉', label: { ko: '이벤트',   en: 'Events',    zh: '活动'   } },
]

const LANGUAGE_ITEMS: Array<{ key: 'ko' | 'en' | 'zh'; label: string; short: string }> = [
  { key: 'ko', label: '한국어', short: 'KR' },
  { key: 'en', label: 'English', short: 'US' },
  { key: 'zh', label: '中文', short: 'CN' },
]

function isLockError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    err.name === 'AbortError' ||
    err.message?.toLowerCase().includes('lock') ||
    err.message?.toLowerCase().includes('steal')
  )
}

function classifyError(err: { code?: string; message?: string }, t: typeof WRITE_UI['ko']): string {
  const code = err.code ?? ''
  const msg = (err.message ?? '').toLowerCase()
  if (code === '42501' || msg.includes('permission') || msg.includes('policy')) return t.errPermission
  if (code === '54000' || msg.includes('too large') || msg.includes('size')) return t.errSize
  return err.message ?? '알 수 없는 오류가 발생했습니다.'
}

interface Props {
  userId: string
  uiLang?: 'ko' | 'en' | 'zh'
  onClose: () => void
  onPosted: () => void | Promise<void>
}

export default function WriteModal({ userId, uiLang = 'ko', onClose, onPosted }: Props) {
  const { showToast } = useToast()
  const t = WRITE_UI[uiLang]

  const [category, setCategory] = useState<Category>('free')
  const [language, setLanguage] = useState<'ko' | 'en' | 'zh'>(uiLang)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)

  // 중복 클릭 방지: React re-render 사이 동기 가드
  const submittingRef = useRef(false)

  const bodyOver = body.length > BODY_MAX
  const titleOver = title.length > TITLE_MAX

  async function handleSubmit() {
    // 동기 가드: 이미 제출 중이면 즉시 차단
    if (submittingRef.current) return
    if (!title.trim()) { showToast('⚠️', t.warnTitle); return }
    if (titleOver)      { showToast('⚠️', t.warnTitleLong); return }
    if (!body.trim())   { showToast('⚠️', t.warnBody); return }
    if (bodyOver)       { showToast('⚠️', t.warnBodyLong); return }

    submittingRef.current = true
    setLoading(true)

    try {
      // 글 등록 (30초 타임아웃)
      // ⚠️ getUser()/getSession() 호출 금지 — Web Locks 잠금 충돌 원인
      const timeout = new Promise<{ error: { message: string; code?: string } }>(
        (resolve) => setTimeout(() => resolve({ error: { message: t.errTimeout, code: 'TIMEOUT' } }), 30000)
      )

      const addPostPromise = async () => {
        try {
          await addDoc(collection(db, 'posts'), {
            user_id: userId,
            title: title.trim(),
            body: body.trim(),
            category,
            language,
            pinned: false,
            created_at: new Date().toISOString()
          })
          return { error: null }
        } catch (err: any) {
          return { error: err }
        }
      }

      const result = await Promise.race([
        addPostPromise(),
        timeout,
      ])

      if (result.error) {
        if (result.error.code === 'TIMEOUT') {
          console.error('[WriteModal] 타임아웃')
          showToast('⏱️', t.errTimeout)
        } else {
          console.error('[WriteModal] insert 에러:', result.error)
          showToast('❌', classifyError(result.error, t))
        }
        return
      }

      console.log('[WriteModal] 글 등록 성공')
      showToast('✅', t.success)
      await onPosted()
      onClose()
    } catch (err: unknown) {
      if (isLockError(err)) {
        console.error('[WriteModal] Lock 에러 (catch):', err)
        showToast('⚠️', t.errLock)
      } else {
        console.error('[WriteModal] 예외 발생 (전체 에러 객체):', err)
        const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
        showToast('❌', msg)
      }
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      onTouchEnd={(e) => { e.stopPropagation() }}
    >
      <div
        className="write-modal"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="write-header">
          <div>
            <div className="write-title">{t.title}</div>
            <div className="write-subtitle">{t.subtitle}</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="write-section">
          <div className="section-label">{t.category}</div>
          <div className="pill-row">
            {CATEGORY_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`cat-pill ${category === item.key ? 'selected' : ''}`}
                onClick={() => setCategory(item.key)}
              >
                <span className="pill-icon">{item.icon}</span>
                {item.label[uiLang]}
              </button>
            ))}
          </div>
        </div>

        <div className="write-section">
          <div className="section-label">{t.language}</div>
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
          <label htmlFor="post-title" className="field-label">{t.titleLabel}</label>
          <input
            id="post-title"
            name="post-title"
            className={`field-input ${titleOver ? 'field-over' : ''}`}
            type="text"
            placeholder={t.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className={`char-count ${titleOver ? 'over' : ''}`}>
            {title.length} / {TITLE_MAX}
          </div>
        </div>

        <div className="modal-field">
          <label htmlFor="post-body" className="field-label">{t.bodyLabel}</label>
          <textarea
            id="post-body"
            name="post-body"
            className={`field-textarea ${bodyOver ? 'field-over' : ''}`}
            placeholder={t.bodyPlaceholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
          />
          <div className={`char-count ${bodyOver ? 'over' : ''}`}>
            {body.length} / {BODY_MAX}
          </div>
        </div>

        <div className="write-footer">
          <div className="write-tip">{t.tip}</div>
          <div className="write-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={(e) => { e.stopPropagation(); onClose() }}
              onTouchEnd={(e) => { e.stopPropagation(); if (!loading) onClose() }}
              disabled={loading}
              style={{ position: 'relative', zIndex: 1 }}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              className="btn-submit"
              onClick={(e) => { e.stopPropagation(); handleSubmit() }}
              onTouchEnd={(e) => { e.stopPropagation(); if (!loading && !bodyOver && !titleOver) handleSubmit() }}
              disabled={loading || bodyOver || titleOver}
              style={{ position: 'relative', zIndex: 1 }}
            >
              {loading ? t.submitting : t.submit}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
