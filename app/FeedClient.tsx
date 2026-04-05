'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Post, Profile, Category } from '@/lib/types'
import PostCard from '@/components/PostCard'
import WriteModal from '@/components/WriteModal'

interface Props {
  user: User
  profile: Profile
  initialPosts: FeedPost[]
  stats: {
    posts: number
    members: number
    today: number
  }
}

type FeedPost = Post & {
  user_liked?: boolean
}

export default function FeedClient({
  user,
  profile,
  initialPosts,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [posts, setPosts] = useState<FeedPost[]>(initialPosts ?? [])
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all')
  const [showWriteModal, setShowWriteModal] = useState(false)

  const fetchPosts = useCallback(async () => {
    setLoading(true)

    const { data, error } = await (supabase as any)
      .from('posts')
      .select(`
        *,
        profiles (id, username, flag, role, avatar_letter),
        likes (count),
        comments (count)
      `)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('fetch posts error:', error)
      setLoading(false)
      return
    }

    const postRows = ((data ?? []) as any[]).map((p) => ({
      ...p,
      user_liked: false,
    })) as FeedPost[]

    const { data: myLikes, error: likesError } = await (supabase as any)
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id)

    if (likesError) {
      console.error('fetch likes error:', likesError)
      setPosts(postRows)
      setLoading(false)
      return
    }

    const likedRows = (myLikes ?? []) as Array<{ post_id: string }>
    const likedIds = new Set(likedRows.map((l) => l.post_id))

    setPosts(
      postRows.map((p) => ({
        ...p,
        user_liked: likedIds.has(p.id),
      }))
    )

    setLoading(false)
  }, [supabase, user.id])

  useEffect(() => {
    setPosts(initialPosts ?? [])
  }, [initialPosts])

  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'all') return posts
    return posts.filter((post) => post.category === selectedCategory)
  }, [posts, selectedCategory])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/auth')
    router.refresh()
  }

  return (
    <main className="feed-page">
      <header className="feed-header">
        <div>
          <h1>AI 경영학과 커뮤니티</h1>
          <p>안녕하세요, {profile?.username ?? user.email ?? '사용자'}님</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="write-btn" onClick={() => setShowWriteModal(true)}>
            새 글 작성
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>

      <section className="feed-filters">
        <button
          className={selectedCategory === 'all' ? 'active' : ''}
          onClick={() => setSelectedCategory('all')}
        >
          전체
        </button>
        <button
          className={selectedCategory === 'free' ? 'active' : ''}
          onClick={() => setSelectedCategory('free')}
        >
          자유
        </button>
        <button
          className={selectedCategory === 'qa' ? 'active' : ''}
          onClick={() => setSelectedCategory('qa')}
        >
          Q&A
        </button>
        <button
          className={selectedCategory === 'study' ? 'active' : ''}
          onClick={() => setSelectedCategory('study')}
        >
          스터디
        </button>
        <button
          className={selectedCategory === 'career' ? 'active' : ''}
          onClick={() => setSelectedCategory('career')}
        >
          취업
        </button>
        <button
          className={selectedCategory === 'notice' ? 'active' : ''}
          onClick={() => setSelectedCategory('notice')}
        >
          공지
        </button>
        <button
          className={selectedCategory === 'resource' ? 'active' : ''}
          onClick={() => setSelectedCategory('resource')}
        >
          자료
        </button>
        <button
          className={selectedCategory === 'event' ? 'active' : ''}
          onClick={() => setSelectedCategory('event')}
        >
          이벤트
        </button>
      </section>

      <section className="feed-list">
        {loading ? (
          <div className="empty-state">불러오는 중...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="empty-state">아직 게시글이 없습니다.</div>
        ) : (
          filteredPosts.map((post, idx) => (
            <PostCard
              key={post.id}
              post={post}
              userId={user.id}
              animDelay={idx * 0.03}
            />
          ))
        )}
      </section>

      {showWriteModal && (
        <WriteModal
          userId={user.id}
          onClose={() => setShowWriteModal(false)}
          onPosted={async () => {
            setShowWriteModal(false)
            await fetchPosts()
          }}
        />
      )}
    </main>
  )
}