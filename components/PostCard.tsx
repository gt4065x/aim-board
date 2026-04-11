'use client'

import { useState, useEffect, useRef } from 'react'
import { Post, Category } from '@/lib/types'
import { useToast } from './Toast'
import PostDetailModal from './PostDetailModal'
import { collection, query, where, orderBy, getDocs, addDoc, doc, getDoc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

const CATEGORY_INFO: Record<Category, { label: string; cls: string }> = {
  free: { label: '자유', cls: 'cat-free' },
  qa: { label: 'Q&A', cls: 'cat-qa' },
  study: { label: '스터디', cls: 'cat-study' },
  career: { label: '취업', cls: 'cat-career' },
  notice: { label: '공지', cls: 'cat-notice' },
  resource: { label: '자료', cls: 'cat-resource' },
  event: { label: '이벤트', cls: 'cat-event' },
}

function avatarClass(flag: string) {
  if (flag === '🇰🇷') return 'av-ko'
  if (flag === '🇺🇸') return 'av-en'
  if (flag === '🇨🇳') return 'av-zh'
  return ''
}

function renderWithLinks(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        style={{ color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all' }}
        onClick={(e) => e.stopPropagation()}
      >{part}</a>
    ) : part
  )
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url)
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

const COMMENT_MAX = 500

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
  uiLang?: 'ko' | 'en' | 'zh'
  currentUserProfile?: CurrentUserProfile | null
  currentUserRole?: string
  animDelay?: number
}

export default function PostCard({ post, userId, uiLang = 'ko', currentUserProfile, currentUserRole, animDelay = 0 }: Props) {
  const { showToast } = useToast()

  const [liked, setLiked] = useState(post.user_liked ?? false)
  const [likes, setLikes] = useState(post.likes?.[0]?.count ?? 0)
  const [showDetail, setShowDetail] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editTitle, setEditTitle] = useState(post.title)
  const [editBody, setEditBody] = useState(post.body)
  const [deleted, setDeleted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const isOwner = userId === post.user_id
  const isAdmin = currentUserRole === 'admin'

  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  async function handleDelete() {
    try {
      if (isAdmin && !isOwner) {
        // 어드민이 타인 글 삭제: 서버 API 경유
        const { getIdToken } = await import('firebase/auth')
        const { auth } = await import('@/lib/firebase/client')
        const currentUser = auth.currentUser
        if (!currentUser) throw new Error('로그인 상태가 아닙니다.')
        const idToken = await getIdToken(currentUser)

        const res = await fetch('/api/admin/delete-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ postId: post.id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? '삭제 실패')
      } else {
        await deleteDoc(doc(db, 'posts', post.id))
      }
      setDeleted(true)
      showToast('✅', '게시글이 삭제되었습니다.')
    } catch (e: any) {
      console.error('[delete] failed:', e)
      showToast('❌', `삭제 실패: ${e?.code || e?.message || '오류'}`)
    }
  }

  async function handleEditSave() {
    if (!editTitle.trim()) { showToast('❌', '제목을 입력해주세요.'); return }
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        title: editTitle.trim(),
        body: editBody.trim(),
      })
      setEditing(false)
      showToast('✅', '수정되었습니다.')
    } catch {
      showToast('❌', '수정 중 오류가 발생했습니다.')
    }
  }

  if (deleted) return null

  const [translated, setTranslated] = useState<{ title: string; body: string } | null>(null)
  const [translating, setTranslating] = useState(false)
  const [showTranslated, setShowTranslated] = useState(false)

  const [showComments, setShowComments] = useState(false)
  const [commentList, setCommentList] = useState<CommentRow[]>([])
  // For initial display if comments length was fetched, else 0
  const [commentCount, setCommentCount] = useState(post.comments?.[0]?.count ?? 0)
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)

  const submittingRef = useRef(false)

  // Firebase: Fetch real likes count and user_liked state on load since it's missing in initial load sometimes
  useEffect(() => {
    if (!post.id) return
    console.log(`[NUCLEAR-DEBUG] PostCard ID: "${post.id}" (Ref: ${post.title.substring(0, 10)}...)`)
    
    // 1. Real-time Likes
    const qLikes = query(collection(db, 'likes'), where('post_id', '==', post.id))
    const unsubLikes = onSnapshot(qLikes, (snap) => {
      setLikes(snap.size)
      if (userId) {
        const likedByMe = snap.docs.some(d => (d.data().user_id || d.data().userId) === userId)
        setLiked(likedByMe)
      }
    })

    // 2. Real-time Comment Count
    const qCommentsCount = query(collection(db, 'comments'), where('post_id', '==', post.id))
    const unsubCommentsCount = onSnapshot(qCommentsCount, (snap) => {
      setCommentCount(snap.size)
    })

    return () => {
      unsubLikes()
      unsubCommentsCount()
    }
  }, [post.id, userId])

  useEffect(() => {
    setTranslated(null)
    setShowTranslated(false)
  }, [uiLang])

  useEffect(() => {
    if (!showComments || !post.id) return

    setLoadingComments(true)
    console.log(`[DEBUG] PostCard loading comments listener for: ${post.id}`)
    
    const q = query(collection(db, 'comments'), where('post_id', '==', post.id))
    
    const unsubscribe = onSnapshot(q, async (snap) => {
      console.log(`[DEBUG] PostCard comments snapshot: ${snap.size}`)
      
      if (snap.empty) {
        setCommentList([])
        setLoadingComments(false)
        return
      }

      const userIds = Array.from(new Set(snap.docs.map(d => d.data().user_id || d.data().userId).filter(Boolean))) as string[]
      const profileMap: Record<string, any> = {}

      if (userIds.length > 0) {
        try {
          for (let i = 0; i < userIds.length; i += 30) {
            const chunk = userIds.slice(i, i + 30)
            const pSnap = await getDocs(query(collection(db, 'profiles'), where('id', 'in', chunk)))
            pSnap.forEach(d => { profileMap[d.id] = d.data() })
          }
        } catch (e) {
          console.error('[DEBUG] PostCard profile fetch error:', e)
        }
      }

      const loaded = snap.docs.map(d => {
        const data = d.data()
        const uid = data.user_id || data.userId
        return {
          id: d.id,
          ...data,
          profiles: profileMap[uid] || null
        } as CommentRow
      })

      loaded.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
        return timeA - timeB
      })

      setCommentList(loaded)
      setLoadingComments(false)
    }, (err) => {
      console.error('[DEBUG] PostCard onSnapshot failed:', err)
      showToast('❌', '댓글 로딩 중 오류가 발생했습니다.')
      setLoadingComments(false)
    })

    return () => unsubscribe()
  }, [showComments, post.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stub for compatibility with existing toggle logic
  async function fetchComments() {}

  async function toggleComments() {
    const next = !showComments
    setShowComments(next)
    if (next && commentList.length === 0) {
      await fetchComments()
    }
  }

  async function handleCommentSubmit() {
    if (submittingRef.current) return
    if (!userId) { showToast('⚠️', '로그인이 필요합니다'); return }
    const body = commentBody.trim()
    if (!body) return
    if (body.length > COMMENT_MAX) { showToast('⚠️', `댓글이 너무 깁니다. 최대 ${COMMENT_MAX}자까지만 입력 가능합니다.`); return }

    submittingRef.current = true

    const optimisticId = `optimistic-${Date.now()}`
    const optimisticComment: CommentRow = {
      id: optimisticId, body, created_at: new Date().toISOString(), user_id: userId, profiles: currentUserProfile ?? null,
    }
    setCommentList((prev) => [...prev, optimisticComment])
    setCommentCount((c) => c + 1)
    setCommentBody('')
    setSubmitting(true)

    try {
      await addDoc(collection(db, 'comments'), { post_id: post.id, user_id: userId, body, created_at: new Date().toISOString() })
      await fetchComments()
    } catch (err) {
      console.error('insert comment exception:', err)
      setCommentList((prev) => prev.filter((c) => c.id !== optimisticId))
      setCommentCount((c) => c - 1)
      setCommentBody(body)
      showToast('❌', '댓글 등록 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
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
      if (data.error) showToast('❌', data.error)
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
      } catch (err) {
        setLiked(true); setLikes((l) => l + 1)
        showToast('❌', '좋아요 취소 중 오류가 발생했습니다.')
      }
    } else {
      setLiked(true); setLikes((l) => l + 1)
      try {
        await setDoc(likeRef, { post_id: post.id, user_id: userId, created_at: new Date().toISOString() })
      } catch (err) {
        setLiked(false); setLikes((l) => l - 1)
        showToast('❌', '좋아요 중 오류가 발생했습니다.')
      }
    }
  }

  // feed의 post.profiles가 없다면, 직접 채워주기 위해 (하지만 feedClient가 이미 profiles 조인 안되어있음)
  const [profile, setProfile] = useState<{username: string; flag: string; avatar_letter: string; role: string} | null>(post.profiles || null)
  
  useEffect(() => {
    if (!profile && post.user_id) {
      getDoc(doc(db, 'profiles', post.user_id)).then(snap => {
        if(snap.exists()) setProfile(snap.data() as any)
      })
    }
  }, [post.user_id, profile])

  const avCls = profile ? avatarClass(profile.flag) : 'av-ko'
  const catInfo = CATEGORY_INFO[post.category] ?? { label: post.category, cls: 'cat-free' }

  return (
    <div className={`post-card ${post.pinned ? 'pinned' : ''}`} style={{ animationDelay: `${animDelay}s` }}>
      {post.pinned && <div className="pin-badge">📌 공지</div>}

      <div className="post-meta">
        <div className={`post-avatar ${avCls}`} style={!avCls ? { background: 'linear-gradient(135deg,#f77f00,#d62828)' } : {}}>
          {profile?.avatar_letter ?? '?'}
        </div>
        <div className="post-info">
          <div className="post-author">
            {profile?.username ?? '알 수 없음'}
            <span style={{ fontSize: 13, marginLeft: 4 }}>{profile?.flag}</span>
            {profile?.role === 'professor' && <span className="post-role">PROF</span>}
          </div>
          <div className="post-time">{timeAgo(post.created_at)}</div>
        </div>
        <span className={`post-category ${catInfo.cls}`}>{catInfo.label}</span>
        {(isOwner || isAdmin) && (
          <div ref={menuRef} style={{ position: 'relative', marginLeft: 'auto' }}>
            <button onClick={() => setShowMenu(m => !m)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text3)', fontSize: 18, padding: '0 4px', lineHeight: 1,
            }}>⋯</button>
            {showMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 50,
                background: 'var(--surface)', border: '1px solid var(--border2)',
                borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                overflow: 'hidden', minWidth: 110,
              }}>
                {isOwner && (
                  <button onClick={() => { setEditing(true); setShowMenu(false) }} style={{
                    display: 'block', width: '100%', padding: '10px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text1)', fontSize: 13, textAlign: 'left',
                  }}>✏️ 수정</button>
                )}
                {confirmDelete ? (
                  <div style={{ padding: '8px 12px', borderTop: isOwner ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>정말 삭제할까요?</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); setConfirmDelete(false); handleDelete() }} style={{
                        flex: 1, padding: '6px', background: '#ef4444', border: 'none',
                        borderRadius: 6, cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600,
                      }}>삭제</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }} style={{
                        flex: 1, padding: '6px', background: 'var(--surface2)', border: '1px solid var(--border2)',
                        borderRadius: 6, cursor: 'pointer', color: 'var(--text2)', fontSize: 12,
                      }}>취소</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }} style={{
                    display: 'block', width: '100%', padding: '10px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ef4444', fontSize: 13, textAlign: 'left',
                  }}>🗑️ 삭제</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0' }}>
          <input
            className="field-input"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="제목"
            style={{ fontWeight: 600 }}
          />
          <textarea
            className="field-input"
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            placeholder="내용"
            rows={4}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-submit" onClick={handleEditSave} style={{ flex: 1, padding: '8px' }}>저장</button>
            <button onClick={() => { setEditing(false); setEditTitle(post.title); setEditBody(post.body) }}
              style={{ flex: 1, padding: '8px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, cursor: 'pointer', color: 'var(--text2)', fontSize: 13 }}>취소</button>
          </div>
        </div>
      ) : (
        <>
          <div className="post-title post-clickable" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
            {showTranslated && translated ? translated.title : editTitle || post.title}
          </div>
          <div className="post-body post-clickable" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer', whiteSpace: 'pre-wrap' }}>
            {renderWithLinks(showTranslated && translated ? translated.body : editBody || post.body)}
          </div>
          {post.attachments && post.attachments.length > 0 && (
            <div className="post-attachments">
              {post.attachments.filter(isImageUrl).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <img src={url} alt={`첨부 이미지 ${i + 1}`} className="post-thumb" />
                </a>
              ))}
              {post.attachments.filter(u => !isImageUrl(u)).map((url, i) => (
                <a key={`f-${i}`} href={url} target="_blank" rel="noopener noreferrer"
                  className="post-file-link" onClick={(e) => e.stopPropagation()}>
                  📎 {decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '파일')}
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {!editing && showTranslated && translated && (
        <div className="translate-badge">🌐 AI 번역됨 (원문 언어: {post.language})</div>
      )}

      <div className="post-footer">
        <button className={`react-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>👍 <span>{likes}</span></button>
        <button className={`react-btn ${showComments ? 'active' : ''}`} onClick={toggleComments}>💬 <span>{commentCount}</span></button>
        <button className={`react-btn translate-btn ${showTranslated ? 'active' : ''}`} onClick={handleTranslate} disabled={translating}
          title={`ChatGPT로 ${uiLang === 'en' ? '영어' : uiLang === 'zh' ? '중국어' : '한국어'} 번역`}>
          {translating ? '⏳' : '🌐'} <span>{translating ? '번역 중...' : showTranslated ? '원문 보기' : 'AI 번역'}</span>
        </button>
      </div>

      {showComments && (
        <div className="comment-section">
          {loadingComments ? (
            <div className="comment-loading">댓글 로딩 중...</div>
          ) : commentList.length === 0 ? (
            <div className="comment-empty">첫 번째 댓글을 남겨보세요!</div>
          ) : (
            <div className="comment-list">
              {commentList.map((c) => (
                <div key={c.id} className="comment-item">
                  <div className={`comment-avatar ${avatarClass(c.profiles?.flag ?? '')}`} style={!avatarClass(c.profiles?.flag ?? '') ? { background: 'linear-gradient(135deg,#f77f00,#d62828)' } : {}}>
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
              ))}
            </div>
          )}

          <div className="comment-input-wrap">
            <div className="comment-input-row">
              <textarea className={`comment-textarea ${commentBody.length > COMMENT_MAX ? 'field-over' : ''}`} placeholder="댓글을 입력하세요..."
                value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={2} disabled={submitting}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommentSubmit() }} />
              <button className="comment-submit" onClick={handleCommentSubmit} disabled={submitting || !commentBody.trim() || commentBody.length > COMMENT_MAX}>
                {submitting ? '...' : '등록'}
              </button>
            </div>
            <div className={`char-count ${commentBody.length > COMMENT_MAX ? 'over' : ''}`}>{commentBody.length} / {COMMENT_MAX}</div>
          </div>
        </div>
      )}

      {showDetail && (
        <PostDetailModal
          post={{ ...post, user_liked: liked, likes: [{ count: likes }], comments: [{ count: commentCount }], profiles: profile as any }}
          userId={userId} currentUserProfile={currentUserProfile} uiLang={uiLang} onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  )
}
