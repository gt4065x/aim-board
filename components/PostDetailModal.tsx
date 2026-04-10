'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Post } from '@/lib/types'
import { useToast } from './Toast'
import { collection, query, where, orderBy, getDocs, addDoc, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

const COMMENT_MAX = 500

const CATEGORY_LABEL: Record<string, string> = {
  free: '자유', qa: 'Q&A', study: '스터디', career: '취업',
  notice: '공지', resource: '자료', event: '이벤트',
}
const CATEGORY_CLS: Record<string, string> = {
  free: 'cat-free', qa: 'cat-qa', study: 'cat-study', career: 'cat-career',
  notice: 'cat-notice', resource: 'cat-resource', event: 'cat-event',
}
const LANG_FLAG: Record<string, string> = { ko: '🇰🇷', en: '🇺🇸', zh: '🇨🇳' }
const LANG_NAME: Record<string, string> = { ko: '한국어', en: '영어', zh: '중국어' }

function renderWithLinks(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        style={{ color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all' }}
      >{part}</a>
    ) : part
  )
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url)
}

function avatarClass(flag: string) {
  if (flag === '🇰🇷') return 'av-ko'
  if (flag === '🇺🇸') return 'av-en'
  if (flag === '🇨🇳') return 'av-zh'
  return ''
}

function timeAgo(dateStr: string) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

interface CommentRow {
  id: string
  body: string
  created_at: string
  user_id: string
  profiles?: { username: string; flag: string; avatar_letter: string } | null
}

interface CurrentUserProfile {
  username: string
  flag: string
  avatar_letter: string
}

interface Props {
  post: Post & { user_liked?: boolean }
  userId: string | null
  currentUserProfile?: CurrentUserProfile | null
  uiLang?: 'ko' | 'en' | 'zh'
  onClose: () => void
}

function PostDetailModalInner({ post, userId, currentUserProfile, uiLang = 'ko', onClose }: Props) {
  const { showToast } = useToast()

  const profile = post.profiles
  const avCls = profile ? avatarClass(profile.flag) : ''
  const catLabel = CATEGORY_LABEL[post.category] ?? post.category
  const catCls = CATEGORY_CLS[post.category] ?? 'cat-free'

  const [liked, setLiked] = useState(post.user_liked ?? false)
  const [likes, setLikes] = useState(post.likes?.[0]?.count ?? 0)

  const [commentList, setCommentList] = useState<CommentRow[]>([])
  const [commentCount, setCommentCount] = useState(post.comments?.[0]?.count ?? 0)
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingComments, setLoadingComments] = useState(true)
  const submittingRef = useRef(false)

  const [translated, setTranslated] = useState<{ title: string; body: string } | null>(null)
  const [translating, setTranslating] = useState(false)
  const [showTranslated, setShowTranslated] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchComments() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchComments() {
    setLoadingComments(true)
    try {
      const q = query(collection(db, 'comments'), where('post_id', '==', post.id), orderBy('created_at', 'asc'))
      const snap = await getDocs(q)

      const loaded: CommentRow[] = []
      for (const d of snap.docs) {
        const c = { id: d.id, ...d.data() } as any
        try {
          const profileSnap = await getDoc(doc(db, 'profiles', c.user_id))
          c.profiles = profileSnap.exists() ? profileSnap.data() : null
        } catch(e) { }
        loaded.push(c as CommentRow)
      }
      setCommentList(loaded)
      setCommentCount(loaded.length)
    } catch { }
    finally { setLoadingComments(false) }
  }

  async function handleTranslate() {
    if (translated) { setShowTranslated((v) => !v); return }
    setTranslating(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: post.title, body: post.body, targetLang: uiLang }),
      })
      const data = await res.json()
      if (data.error) { showToast('❌', data.error) }
      else { setTranslated(data); setShowTranslated(true) }
    } catch { showToast('❌', '번역 중 오류가 발생했습니다.') }
    finally { setTranslating(false) }
  }

  async function toggleLike() {
    if (!userId) { showToast('⚠️', '로그인이 필요합니다'); return }
    const likeRef = doc(db, 'likes', `${post.id}_${userId}`)

    if (liked) {
      setLiked(false); setLikes((l) => l - 1)
      try {
        await deleteDoc(likeRef)
      } catch { setLiked(true); setLikes((l) => l + 1); showToast('❌', '좋아요 취소 실패') }
    } else {
      setLiked(true); setLikes((l) => l + 1)
      try {
        await setDoc(likeRef, { post_id: post.id, user_id: userId, created_at: new Date().toISOString() })
      } catch { setLiked(false); setLikes((l) => l - 1); showToast('❌', '좋아요 실패') }
    }
  }

  async function handleCommentSubmit() {
    if (submittingRef.current) return
    if (!userId) { showToast('⚠️', '로그인이 필요합니다'); return }
    const body = commentBody.trim()
    if (!body) return
    if (body.length > COMMENT_MAX) { showToast('⚠️', `최대 ${COMMENT_MAX}자까지만 입력 가능합니다.`); return }

    submittingRef.current = true
    const optimisticId = `optimistic-${Date.now()}`
    setCommentList((prev) => [...prev, { id: optimisticId, body, created_at: new Date().toISOString(), user_id: userId, profiles: currentUserProfile ?? null }])
    setCommentCount((c) => c + 1)
    setCommentBody('')
    setSubmitting(true)

    try {
      await addDoc(collection(db, 'comments'), { post_id: post.id, user_id: userId, body, created_at: new Date().toISOString() })
      await fetchComments()
    } catch (err) {
      showToast('❌', '댓글 등록 중 오류가 발생했습니다.')
      setCommentList((prev) => prev.filter((c) => c.id !== optimisticId))
      setCommentCount((c) => c - 1)
      setCommentBody(body)
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  const translateBtn = (
    <button className={`react-btn translate-btn ${showTranslated ? 'active' : ''}`} onClick={handleTranslate} disabled={translating}
      title={`ChatGPT로 ${LANG_NAME[uiLang] ?? '번역'}`}>
      {translating ? '⏳' : '🌐'} <span>{translating ? '번역 중...' : showTranslated ? '원문 보기' : 'AI 번역'}</span>
    </button>
  )

  return (
    <div className="pdm-overlay" onClick={onClose}>
      <div className="pdm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="pdm-sticky-header">
          <div className="post-meta" style={{ flex: 1, minWidth: 0 }}>
            <div className={`post-avatar ${avCls}`} style={!avCls ? { background: 'linear-gradient(135deg,#f77f00,#d62828)' } : {}}>
              {profile?.avatar_letter ?? '?'}
            </div>
            <div className="post-info">
              <div className="post-author">
                {profile?.username ?? '알 수 없음'}
                <span style={{ fontSize: 13, marginLeft: 4 }}>{profile?.flag}</span>
                {profile?.role === 'professor' && <span className="post-role">PROF</span>}
              </div>
              <div className="post-time">
                {timeAgo(post.created_at)}
                <span style={{ marginLeft: 6 }}>{LANG_FLAG[post.language] ?? ''}</span>
              </div>
            </div>
            <span className={`post-category ${catCls}`}>{catLabel}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="pdm-scroll">
          <div className="pdm-title">
            {post.pinned && <span className="pin-badge" style={{ marginRight: 8, fontSize: 12 }}>📌 공지</span>}
            {showTranslated && translated ? translated.title : post.title}
          </div>

          <div className="pdm-actions">
            <button className={`react-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>👍 <span>{likes}</span></button>
            <span className="comment-count">💬 {commentCount}</span>
            {translateBtn}
          </div>

          {showTranslated && translated && (
            <div className="translate-badge" style={{ marginBottom: 12 }}>🌐 AI 번역됨 (원문: {post.language.toUpperCase()})</div>
          )}

          <div className="pdm-body" style={{ whiteSpace: 'pre-wrap' }}>
            {renderWithLinks(showTranslated && translated ? translated.body : post.body)}
          </div>

          {/* 이미지 썸네일 및 첨부파일 */}
          {post.attachments && post.attachments.length > 0 && (
            <div className="post-attachments" style={{ marginTop: 16 }}>
              {post.attachments.filter(isImageUrl).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`첨부 이미지 ${i + 1}`} className="post-thumb post-thumb-lg" />
                </a>
              ))}
              {post.attachments.filter(u => !isImageUrl(u)).map((url, i) => (
                <a key={`f-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="post-file-link">
                  📎 {decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '파일')}
                </a>
              ))}
            </div>
          )}

          <div className="pdm-actions" style={{ marginTop: 16 }}>{translateBtn}</div>

          <div className="pdm-comments">
            <div className="pdm-comments-title">댓글 {commentCount}개</div>
            {loadingComments ? (
              <div className="comment-loading">댓글 로딩 중...</div>
            ) : commentList.length === 0 ? (
              <div className="comment-empty">첫 번째 댓글을 남겨보세요!</div>
            ) : (
              <div className="comment-list">
                {commentList.map((c) => {
                  const cls = avatarClass(c.profiles?.flag ?? '')
                  return (
                    <div key={c.id} className="comment-item">
                      <div className={`comment-avatar ${cls}`} style={!cls ? { background: 'linear-gradient(135deg,#f77f00,#d62828)' } : {}}>
                        {c.profiles?.avatar_letter ?? '?'}
                      </div>
                      <div className="comment-content">
                        <div className="comment-author">
                          {c.profiles?.username ?? '알 수 없음'}
                          <span className="comment-flag">{c.profiles?.flag}</span>
                          <span className="comment-time">{timeAgo(c.created_at)}</span>
                        </div>
                        <div className="comment-body">{c.body}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="comment-input-wrap" style={{ marginTop: 12 }}>
              <div className="comment-input-row">
                <textarea className={`comment-textarea ${commentBody.length > COMMENT_MAX ? 'field-over' : ''}`}
                  placeholder="댓글을 입력하세요... (Ctrl+Enter로 등록)" value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={2} disabled={submitting}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommentSubmit() }} />
                <button className="comment-submit" onClick={handleCommentSubmit} disabled={submitting || !commentBody.trim() || commentBody.length > COMMENT_MAX}>
                  {submitting ? '...' : '등록'}
                </button>
              </div>
              <div className={`char-count ${commentBody.length > COMMENT_MAX ? 'over' : ''}`}>
                {commentBody.length} / {COMMENT_MAX}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PostDetailModal(props: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(<PostDetailModalInner {...props} />, document.body)
}
