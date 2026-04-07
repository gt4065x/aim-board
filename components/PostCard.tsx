'use client'

import { useState, useEffect, useRef } from 'react'
import { Post, Category } from '@/lib/types'
import { useToast } from './Toast'
import PostDetailModal from './PostDetailModal'
import { collection, query, where, orderBy, getDocs, addDoc, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
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
  animDelay?: number
}

export default function PostCard({ post, userId, uiLang = 'ko', currentUserProfile, animDelay = 0 }: Props) {
  const { showToast } = useToast()

  const [liked, setLiked] = useState(post.user_liked ?? false)
  const [likes, setLikes] = useState(post.likes?.[0]?.count ?? 0)
  const [showDetail, setShowDetail] = useState(false)

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
    async function loadLikes() {
      const q = query(collection(db, 'likes'), where('post_id', '==', post.id))
      const snap = await getDocs(q)
      setLikes(snap.size)
      if (userId) setLiked(snap.docs.some(d => d.data().user_id === userId))
      
      // Load comment count
      const cQ = query(collection(db, 'comments'), where('post_id', '==', post.id))
      const cSnap = await getDocs(cQ)
      setCommentCount(cSnap.size)
    }
    loadLikes()
  }, [post.id, userId])

  useEffect(() => {
    setTranslated(null)
    setShowTranslated(false)
  }, [uiLang])

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
    } catch (err) {
      console.error('fetch comments exception:', err)
      showToast('❌', '댓글을 불러오지 못했습니다.')
    } finally {
      setLoadingComments(false)
    }
  }

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
      </div>

      <div className="post-title post-clickable" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
        {showTranslated && translated ? translated.title : post.title}
      </div>
      <div className="post-body post-clickable" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
        {showTranslated && translated ? translated.body : post.body}
      </div>

      {showTranslated && translated && (
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
