'use client'

import { useState, useRef } from 'react'
import { db, storage } from '@/lib/firebase/client'
import { collection, addDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Category, Role } from '@/lib/types'
import { useToast } from './Toast'

const TITLE_MAX = 120
const BODY_MAX = 2000
const FILE_MAX_MB = 10
const FILE_MAX_BYTES = FILE_MAX_MB * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/zip',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']

// 스탭 이상만 글쓰기 가능한 카테고리 (파일 업로드도 여기서만)
const STAFF_ONLY: Category[] = ['notice', 'career', 'resource', 'event']
// 일반 사용자도 글쓰기 가능한 카테고리
const USER_WRITABLE: Category[] = ['free', 'study', 'qa']

export function isElevated(role: Role | undefined | null): boolean {
  return role === 'admin' || role === 'staff' || role === 'professor'
}

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
    errFileSize: `파일 크기는 ${FILE_MAX_MB}MB 이하여야 합니다.`,
    errFileType: '지원하지 않는 파일 형식입니다.',
    success: '게시글이 등록되었습니다',
    uploading: '파일 업로드 중...',
    attachFile: '파일 첨부',
    attachHint: `이미지, PDF, 문서 등 최대 ${FILE_MAX_MB}MB`,
    noPermission: '이 게시판은 스탭 이상만 글쓰기 가능합니다.',
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
    errFileSize: `File size must be under ${FILE_MAX_MB}MB.`,
    errFileType: 'Unsupported file type.',
    success: 'Post published successfully',
    uploading: 'Uploading files...',
    attachFile: 'Attach File',
    attachHint: `Images, PDFs, documents up to ${FILE_MAX_MB}MB`,
    noPermission: 'Only staff or above can post in this board.',
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
    errFileSize: `文件大小不得超过 ${FILE_MAX_MB}MB。`,
    errFileType: '不支持的文件格式。',
    success: '帖子发布成功',
    uploading: '正在上传文件...',
    attachFile: '附加文件',
    attachHint: `图片、PDF、文档等，最大 ${FILE_MAX_MB}MB`,
    noPermission: '此版块仅限员工以上发帖。',
  },
}

const CATEGORY_ITEMS: Array<{ key: Category; label: Record<'ko' | 'en' | 'zh', string>; icon: string; staffOnly: boolean }> = [
  { key: 'free',     icon: '💬', staffOnly: false, label: { ko: '자유',     en: 'General',   zh: '自由'   } },
  { key: 'qa',       icon: '❓', staffOnly: false, label: { ko: 'Q&A',      en: 'Q&A',       zh: 'Q&A'    } },
  { key: 'study',    icon: '📚', staffOnly: false, label: { ko: '스터디',   en: 'Study',     zh: '学习'   } },
  { key: 'notice',   icon: '📢', staffOnly: true,  label: { ko: '공지',     en: 'Notice',    zh: '公告'   } },
  { key: 'career',   icon: '💼', staffOnly: true,  label: { ko: '취업',     en: 'Career',    zh: '就业'   } },
  { key: 'resource', icon: '📎', staffOnly: true,  label: { ko: '자료',     en: 'Resources', zh: '资料'   } },
  { key: 'event',    icon: '🎉', staffOnly: true,  label: { ko: '이벤트',   en: 'Events',    zh: '活动'   } },
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

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url)
}

interface Props {
  userId: string
  userRole?: Role | null
  uiLang?: 'ko' | 'en' | 'zh'
  onClose: () => void
  onPosted: () => void | Promise<void>
}

export default function WriteModal({ userId, userRole, uiLang = 'ko', onClose, onPosted }: Props) {
  const { showToast } = useToast()
  const t = WRITE_UI[uiLang]
  const elevated = isElevated(userRole)

  const defaultCategory: Category = elevated ? 'free' : 'free'
  const [category, setCategory] = useState<Category>(defaultCategory)
  const [language, setLanguage] = useState<'ko' | 'en' | 'zh'>(uiLang)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)

  const bodyOver = body.length > BODY_MAX
  const titleOver = title.length > TITLE_MAX
  const isStaffBoard = STAFF_ONLY.includes(category)
  const canPost = !isStaffBoard || elevated

  function handleCategorySelect(key: Category) {
    const item = CATEGORY_ITEMS.find(c => c.key === key)
    if (item?.staffOnly && !elevated) return // 클릭 무시
    setCategory(key)
    if (!item?.staffOnly) setFiles([]) // 일반 게시판으로 바뀌면 파일 초기화
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    const invalid = selected.find(f => !ALLOWED_TYPES.includes(f.type))
    if (invalid) { showToast('⚠️', t.errFileType); return }
    const overSize = selected.find(f => f.size > FILE_MAX_BYTES)
    if (overSize) { showToast('⚠️', t.errFileSize); return }
    setFiles(selected)
    e.target.value = ''
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function uploadFiles(): Promise<string[]> {
    if (files.length === 0) return []
    const urls: string[] = []
    for (const file of files) {
      const path = `posts/${userId}/${Date.now()}_${file.name}`
      const ref = storageRef(storage, path)
      await uploadBytes(ref, file)
      const url = await getDownloadURL(ref)
      urls.push(url)
    }
    return urls
  }

  async function handleSubmit() {
    if (submittingRef.current) return
    if (!canPost) { showToast('🔒', t.noPermission); return }
    if (!title.trim()) { showToast('⚠️', t.warnTitle); return }
    if (titleOver)      { showToast('⚠️', t.warnTitleLong); return }
    if (!body.trim())   { showToast('⚠️', t.warnBody); return }
    if (bodyOver)       { showToast('⚠️', t.warnBodyLong); return }

    submittingRef.current = true
    setLoading(true)

    try {
      let attachments: string[] = []
      if (files.length > 0) {
        showToast('⏳', t.uploading)
        attachments = await uploadFiles()
      }

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
            created_at: new Date().toISOString(),
            ...(attachments.length > 0 ? { attachments } : {}),
          })
          return { error: null }
        } catch (err: any) {
          return { error: err }
        }
      }

      const result = await Promise.race([addPostPromise(), timeout])

      if (result.error) {
        if (result.error.code === 'TIMEOUT') {
          showToast('⏱️', t.errTimeout)
        } else {
          showToast('❌', classifyError(result.error, t))
        }
        return
      }

      showToast('✅', t.success)
      await onPosted()
      onClose()
    } catch (err: unknown) {
      if (isLockError(err)) {
        showToast('⚠️', t.errLock)
      } else {
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
            {CATEGORY_ITEMS.map((item) => {
              const locked = item.staffOnly && !elevated
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`cat-pill ${category === item.key ? 'selected' : ''} ${locked ? 'cat-pill-locked' : ''}`}
                  onClick={() => handleCategorySelect(item.key)}
                  title={locked ? t.noPermission : undefined}
                  style={locked ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                >
                  <span className="pill-icon">{item.icon}</span>
                  {item.label[uiLang]}
                  {locked && <span style={{ fontSize: 10, marginLeft: 2 }}>🔒</span>}
                </button>
              )
            })}
          </div>
          {isStaffBoard && !elevated && (
            <div style={{ fontSize: 12, color: 'var(--ko)', marginTop: 6 }}>🔒 {t.noPermission}</div>
          )}
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
            disabled={!canPost}
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
            disabled={!canPost}
          />
          <div className={`char-count ${bodyOver ? 'over' : ''}`}>
            {body.length} / {BODY_MAX}
          </div>
        </div>

        {/* 파일 첨부 - 스탭 전용 게시판에서만 노출 */}
        {elevated && isStaffBoard && (
          <div className="modal-field">
            <label className="field-label">{t.attachFile}</label>
            <div className="attach-area">
              <button
                type="button"
                className="attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                📎 {t.attachFile}
              </button>
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>{t.attachHint}</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_TYPES.join(',')}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {files.length > 0 && (
              <div className="attach-list">
                {files.map((f, i) => (
                  <div key={i} className="attach-item">
                    {f.type.startsWith('image/') && (
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="attach-preview"
                      />
                    )}
                    <span className="attach-name">{f.name}</span>
                    <span className="attach-size">({(f.size / 1024).toFixed(0)}KB)</span>
                    <button type="button" className="attach-remove" onClick={() => removeFile(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
              disabled={loading || bodyOver || titleOver || !canPost}
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
