'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Post, Profile, Category } from '@/lib/types'
import PostCard from '@/components/PostCard'
import WriteModal from '@/components/WriteModal'
import RightPanel from '@/components/RightPanel'
import { ToastProvider, useToast } from '@/components/Toast'

const NAV_ITEMS = [
  { icon: '🏠', label: '전체 피드', category: null, badge: null, badgeCls: '' },
  { icon: '🔥', label: '인기글', category: 'hot', badge: null, badgeCls: '' },
  { icon: '📢', label: '공지사항', category: 'notice', badge: null, badgeCls: '' },
  { icon: '💬', label: '자유게시판', category: 'free', badge: null, badgeCls: '' },
  { icon: '📚', label: '스터디 모집', category: 'study', badge: null, badgeCls: 'blue' },
  { icon: '❓', label: 'Q&A', category: 'qa', badge: null, badgeCls: 'green' },
  { icon: '💼', label: '취업·인턴', category: 'career', badge: null, badgeCls: '' },
  { icon: '📎', label: '자료 공유', category: 'resource', badge: null, badgeCls: '' },
  { icon: '🎉', label: '학과 이벤트', category: 'event', badge: null, badgeCls: '' },
]

interface Props {
  user: User
  profile: Profile | null
  initialPosts: Post[]
  stats: { posts: number; members: number; today: number }
}

function FeedInner({ user, profile, initialPosts, stats }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'new' | 'hot' | 'all'>('all')
  const [langFilter, setLangFilter] = useState({ ko: true, en: true, zh: true })
  const [showModal, setShowModal] = useState(false)

  const avatarLetter = profile?.avatar_letter ?? user.email?.[0]?.toUpperCase() ?? 'U'

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  const refreshPosts = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('posts')
      .select(`*, profiles (id, username, flag, role, avatar_letter), likes (count), comments (count)`)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)

    const { data: myLikes } = await (supabase as any)
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id)

    const likedRows = (myLikes ?? []) as Array<{ post_id: string }>
    const likedIds = new Set(likedRows.map((l) => l.post_id))

    const postRows = (data ?? []) as any[]
    setPosts(postRows.map((p) => ({ ...p, user_liked: likedIds.has(p.id) })))
  }, [supabase, user.id])

  const filtered = posts
    .filter((p) => {
      if (activeCategory && activeCategory !== 'hot' && p.category !== activeCategory) return false
      if (!langFilter[p.language as keyof typeof langFilter]) return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.title.toLowerCase().includes(q) && !p.body.toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      if (sortBy === 'hot') {
        return (b.likes?.[0]?.count ?? 0) - (a.likes?.[0]?.count ?? 0)
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const feedTitle = NAV_ITEMS.find((n) => n.category === activeCategory)?.label ?? '전체 피드'

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <div className="logo-icon">🤖</div>
          <div>
            AI경영학과
            <span className="logo-sub">Woosong · Community</span>
          </div>
        </div>

        <div className="topbar-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="게시글 검색 / Search / 搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="lang-switcher">
          <button className="lang-btn ko active">KO</button>
          <button className="lang-btn en">EN</button>
          <button className="lang-btn zh">ZH</button>
        </div>

        <div className="topbar-actions">
          <div className="notif-btn">
            🔔
            <div className="notif-dot" />
          </div>
          <div
            className="avatar-btn"
            title={profile?.username ?? user.email}
            onClick={signOut}
            style={{ cursor: 'pointer' }}
          >
            {avatarLetter}
          </div>
        </div>
      </header>

      <aside className="sidebar">
        <button className="write-btn" onClick={() => setShowModal(true)}>
          ✏️ 글쓰기
        </button>

        <div className="sidebar-section">
          <div className="sidebar-label">메인</div>
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <div
              key={item.label}
              className={`nav-item ${activeCategory === item.category ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory(item.category)
                if (item.category === 'hot') setSortBy('hot')
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <div className="sidebar-label">게시판</div>
          {NAV_ITEMS.slice(2).map((item) => (
            <div
              key={item.label}
              className={`nav-item ${activeCategory === item.category ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory(item.category as Category)
                setSortBy('all')
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <div className="sidebar-label">내 정보</div>
          <div className="nav-item" style={{ color: 'var(--text2)', fontSize: 12 }}>
            <span className="nav-icon">{profile?.flag ?? '🌍'}</span>
            {profile?.username ?? user.email}
          </div>
          <div className="nav-item" onClick={signOut}>
            <span className="nav-icon">🚪</span>
            로그아웃
          </div>
        </div>
      </aside>

      <main className="main">
        <nav className="mobile-cat-bar">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={`mobile-cat-item ${activeCategory === item.category ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory(item.category as Category | null)
                if (item.category === 'hot') setSortBy('hot')
                else setSortBy('all')
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="feed-header">
          <div className="feed-title">{feedTitle}</div>
          <div className="filter-tabs">
            <button className={`filter-tab ${sortBy === 'all' ? 'active' : ''}`} onClick={() => setSortBy('all')}>
              전체
            </button>
            <button className={`filter-tab ${sortBy === 'hot' ? 'active' : ''}`} onClick={() => setSortBy('hot')}>
              인기순
            </button>
            <button className={`filter-tab ${sortBy === 'new' ? 'active' : ''}`} onClick={() => setSortBy('new')}>
              최신순
            </button>
          </div>
          <div className="lang-filter">
            {(['ko', 'en', 'zh'] as const).map((lang) => (
              <button
                key={lang}
                className={`lf-btn ${lang} ${langFilter[lang] ? 'on' : ''}`}
                onClick={() => setLangFilter((p) => ({ ...p, [lang]: !p[lang] }))}
              >
                {lang === 'ko' ? '🇰🇷 KO' : lang === 'en' ? '🇺🇸 EN' : '🇨🇳 ZH'}
              </button>
            ))}
          </div>
        </div>

        <div className="feed">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📭</div>
              <p>
                게시글이 없습니다.
                <br />
                첫 번째 글을 작성해보세요!
              </p>
            </div>
          ) : (
            filtered.map((post, i) => (
              <PostCard
                key={post.id}
                post={post}
                userId={user.id}
                animDelay={Math.min(i * 0.05, 0.3)}
              />
            ))
          )}
        </div>
      </main>

      <RightPanel stats={stats} />

      <button className="mobile-fab" onClick={() => setShowModal(true)} aria-label="글쓰기">
        ✏️
      </button>

      {showModal && (
        <WriteModal
          userId={user.id}
          onClose={() => setShowModal(false)}
          onPosted={refreshPosts}
        />
      )}
    </div>
  )
}

export default function FeedClient(props: Props) {
  return (
    <ToastProvider>
      <FeedInner {...props} />
    </ToastProvider>
  )
}