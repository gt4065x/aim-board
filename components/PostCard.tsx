'use client'

import { useState } from 'react'
import { Post, Category } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useToast } from './Toast'

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
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

interface Props {
  post: Post & { user_liked?: boolean }
  userId: string | null
  animDelay?: number
}

export default function PostCard({ post, userId, animDelay = 0 }: Props) {
  const supabase = createClient()
  const { showToast } = useToast()

  const likeCount = post.likes?.[0]?.count ?? 0
  const commentCount = post.comments?.[0]?.count ?? 0

  const [liked, setLiked] = useState(post.user_liked ?? false)
  const [likes, setLikes] = useState(likeCount)

  const profile = post.profiles
  const avCls = profile ? avatarClass(profile.flag) : 'av-ko'
  const catInfo = CATEGORY_INFO[post.category] ?? { label: post.category, cls: 'cat-free' }

  async function toggleLike() {
    if (!userId) {
      showToast('⚠️', '로그인이 필요합니다')
      return
    }

    if (liked) {
      setLiked(false)
      setLikes((l) => l - 1)

      const { error } = await (supabase as any)
        .from('likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', userId)

      if (error) {
        console.error('delete like error:', error)
        setLiked(true)
        setLikes((l) => l + 1)
        showToast('❌', error.message)
      }
    } else {
      setLiked(true)
      setLikes((l) => l + 1)

      const insertRow = {
        post_id: post.id,
        user_id: userId,
      }

      const { error } = await (supabase as any)
        .from('likes')
        .insert([insertRow])

      if (error) {
        console.error('insert like error:', error)
        setLiked(false)
        setLikes((l) => l - 1)
        showToast('❌', error.message)
      }
    }
  }

  return (
    <div
      className={`post-card ${post.pinned ? 'pinned' : ''}`}
      style={{ animationDelay: `${animDelay}s` }}
    >
      {post.pinned && <div className="pin-badge">📌 공지</div>}

      <div className="post-meta">
        <div
          className={`post-avatar ${avCls}`}
          style={!avCls ? { background: 'linear-gradient(135deg,#f77f00,#d62828)' } : {}}
        >
          {profile?.avatar_letter ?? '?'}
        </div>
        <div className="post-info">
          <div className="post-author">
            {profile?.username ?? '알 수 없음'}
            <span style={{ fontSize: 13 }}>{profile?.flag}</span>
            {profile?.role === 'professor' && <span className="post-role">PROF</span>}
          </div>
          <div className="post-time">{timeAgo(post.created_at)}</div>
        </div>
        <span className={`post-category ${catInfo.cls}`}>{catInfo.label}</span>
      </div>

      <div className="post-title">{post.title}</div>
      <div className="post-body">{post.body}</div>

      <div className="post-footer">
        <button
          className={`react-btn ${liked ? 'liked' : ''}`}
          onClick={toggleLike}
        >
          👍 <span>{likes}</span>
        </button>
        <span className="comment-count">💬 {commentCount}</span>
      </div>
    </div>
  )
}