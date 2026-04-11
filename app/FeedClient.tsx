'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { User, signOut as firebaseSignOut } from 'firebase/auth'
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, getDocs, where, setDoc } from 'firebase/firestore'
import { ref, onValue, set, onDisconnect, remove } from 'firebase/database'
import { auth, db, rtdb } from '@/lib/firebase/client'
import { Post, Profile, Category, Language } from '@/lib/types'
import PostCard from '@/components/PostCard'
import WriteModal from '@/components/WriteModal'
import RightPanel from '@/components/RightPanel'
import ProfileSettingsModal from '@/components/ProfileSettingsModal'
import NotificationBell from '@/components/NotificationBell'
import AdminPanel from '@/components/AdminPanel'
import DirectChatModal from '@/components/DirectChatModal'
import { ToastProvider, useToast } from '@/components/Toast'

const NAV_META = [
  { icon: '🏠', category: null,       badge: null, badgeCls: '' },
  { icon: '🔥', category: 'hot',      badge: null, badgeCls: '' },
  { icon: '📢', category: 'notice',   badge: null, badgeCls: '' },
  { icon: '💬', category: 'free',     badge: null, badgeCls: '' },
  { icon: '📚', category: 'study',    badge: null, badgeCls: 'blue' },
  { icon: '❓', category: 'qa',       badge: null, badgeCls: 'green' },
  { icon: '💼', category: 'career',   badge: null, badgeCls: '' },
  { icon: '📎', category: 'resource', badge: null, badgeCls: '' },
  { icon: '🎉', category: 'event',    badge: null, badgeCls: '' },
]

const UI = {
  ko: {
    logoTitle: 'AI경영학과', logoSub: 'Woosong · Community',
    write: '✏️ 글쓰기', main: '메인', boards: '게시판', myInfo: '내 정보',
    signOut: '로그아웃', all: '전체', popular: '인기순', latest: '최신순',
    emptyLine1: '게시글이 없습니다.', emptyLine2: '첫 번째 글을 작성해보세요!',
    search: '게시글 검색 / Search / 搜索...',
    nav: ['전체 피드', '인기글', '공지사항', '자유게시판', '스터디 모집', 'Q&A', '취업·인턴', '자료 공유', '학과 이벤트'],
  },
  en: {
    logoTitle: 'AI Management', logoSub: 'Woosong · Community',
    write: '✏️ Write', main: 'Main', boards: 'Boards', myInfo: 'My Info',
    signOut: 'Sign Out', all: 'All', popular: 'Popular', latest: 'Latest',
    emptyLine1: 'No posts yet.', emptyLine2: 'Be the first to write!',
    search: 'Search posts...',
    nav: ['All Feed', 'Popular', 'Notices', 'General', 'Study Group', 'Q&A', 'Jobs & Intern', 'Resources', 'Events'],
  },
  zh: {
    logoTitle: 'AI经营学科', logoSub: '우송大学 · 社区',
    write: '✏️ 写帖子', main: '主', boards: '板块', myInfo: '我的信息',
    signOut: '退出', all: '全部', popular: '热门', latest: '最新',
    emptyLine1: '暂无帖子。', emptyLine2: '来写第一篇吧！',
    search: '搜索帖子...',
    nav: ['全部帖子', '热门', '公告', '自由板', '学习组', 'Q&A', '就业·实习', '资料分享', '学科活动'],
  },
}

function flagToLang(flag: string): Language {
  if (flag === '🇺🇸') return 'en'
  if (flag === '🇨🇳') return 'zh'
  return 'ko'
}

interface HotPost { id: string; title: string; language: string; likes: number }
interface CountryCount { flag: string; count: number }
export interface OnlineUser {
  user_id: string; username: string; flag: string; avatar_letter: string; language?: string;
}

interface Props { user: User }

function FeedInner({ user }: Props) {
  const router = useRouter()
  const { showToast } = useToast()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [liveStats, setLiveStats] = useState({ posts: 0, members: 0, today: 0, langDist: { ko: 33, en: 33, zh: 34 } })
  const [hotPosts, setHotPosts] = useState<HotPost[]>([])
  const [countryDist, setCountryDist] = useState<CountryCount[]>([])
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'new' | 'hot' | 'all'>('all')
  const [langFilter, setLangFilter] = useState({ ko: true, en: true, zh: true })

  const [showModal, setShowModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showMobileOnline, setShowMobileOnline] = useState(false)
  const [chatTarget, setChatTarget] = useState<OnlineUser | null>(null)
  const [isDark, setIsDark] = useState(true)
  const openingModalRef = useRef(false)

  const [uiLang, setUiLang] = useState<Language>('ko')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 초기 테마 로드 (클라이언트 전용)
    const saved = typeof window !== 'undefined' && window.localStorage?.getItem?.('theme')
    if (saved === 'light') setIsDark(false)
  }, [])

  useEffect(() => {
    const html = document.documentElement
    if (isDark) {
      html.classList.remove('light')
      window.localStorage?.setItem?.('theme', 'dark')
    } else {
      html.classList.add('light')
      window.localStorage?.setItem?.('theme', 'light')
    }
  }, [isDark])

  // 1. 프로필 패치 및 언어 설정
  useEffect(() => {
    getDoc(doc(db, 'profiles', user.uid)).then(async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Profile
        setProfile(data)
        if (data.language && ['ko', 'en', 'zh'].includes(data.language)) {
          setUiLang(data.language as Language)
        }
      } else {
        // 프로필 없으면 이메일 기반으로 자동 생성
        const nav = typeof navigator !== 'undefined' ? navigator.language : 'ko'
        const lang = nav.startsWith('zh') ? 'zh' : nav.startsWith('en') ? 'en' : 'ko'
        const defaultUsername = user.email?.split('@')[0] ?? 'User'
        const newProfile: Profile = {
          id: user.uid,
          username: defaultUsername,
          flag: lang === 'zh' ? '🇨🇳' : lang === 'en' ? '🇺🇸' : '🇰🇷',
          language: lang as Language,
          avatar_letter: defaultUsername[0].toUpperCase(),
          role: 'student',
          created_at: new Date().toISOString()
        }
        await setDoc(doc(db, 'profiles', user.uid), newProfile)
        setProfile(newProfile)
        setUiLang(lang as Language)
      }
    })
  }, [user.uid])

  useEffect(() => { document.documentElement.lang = uiLang }, [uiLang])

  // 2. 실시간 게시물 목록 & 통계 패치 (Firestore)
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('created_at', 'desc'), limit(50))
    const unsubPosts = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Post))
      setPosts(prev => {
        const likesMap: Record<string, number> = {}
        prev.forEach(p => { if (p._likes) likesMap[p.id] = p._likes })
        return docs.map(d => ({ ...d, _likes: likesMap[d.id] ?? 0 }))
      })

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayIso = todayStart.toISOString()

      setLiveStats(prev => ({
        ...prev,
        posts: docs.length,
        today: docs.filter(d => (d.created_at || '') >= todayIso).length
      }))
    })

    const unsubProfiles = onSnapshot(collection(db, 'profiles'), (snapshot) => {
      const members = snapshot.size
      const flagMap: Record<string, number> = {}
      snapshot.forEach(d => {
        const f = d.data().flag || '🌍'
        flagMap[f] = (flagMap[f] || 0) + 1
      })
      const sorted = Object.entries(flagMap)
        .map(([flag, count]) => ({ flag, count }))
        .sort((a, b) => b.count - a.count)
      setCountryDist(sorted)
      setLiveStats(prev => ({ ...prev, members }))
    })

    const unsubLikes = onSnapshot(collection(db, 'likes'), (likesSnap) => {
      const likesMap: Record<string, number> = {}
      likesSnap.forEach(d => {
        const pid = d.data().post_id
        if (pid) likesMap[pid] = (likesMap[pid] || 0) + 1
      })
      setPosts(prev => {
        const withLikes = prev.map(p => ({ ...p, _likes: likesMap[p.id] || 0 }))
        const top = [...withLikes]
          .sort((a, b) => b._likes - a._likes)
          .slice(0, 5)
          .map(p => ({ id: p.id, title: p.title, language: p.language, likes: p._likes }))
        setHotPosts(top)
        return withLikes
      })
    })

    setLoading(false)

    return () => { unsubPosts(); unsubProfiles(); unsubLikes() }
  }, [])

  // 3. 실시간 접속자 (Firebase Realtime Database)
  useEffect(() => {
    const userRef = ref(rtdb, `presence/${user.uid}`)
    const username = profile?.username || user.email?.split('@')[0] || 'Guest'
    const flag = profile?.flag || '🌍'
    const avatarLetter = profile?.avatar_letter || (user.email?.[0]?.toUpperCase() ?? 'U')

    onDisconnect(userRef).remove().catch(console.error)
    const language = profile?.language || 'ko'
    set(userRef, {
      user_id: user.uid,
      username,
      flag,
      avatar_letter: avatarLetter,
      language,
      onlineAt: Date.now()
    }).catch((err) => console.error('presence set 실패 (RTDB 규칙 확인 필요):', err))

    // 본인을 항상 목록에 포함시켜 즉시 반영
    const selfUser: OnlineUser = { user_id: user.uid, username, flag, avatar_letter: avatarLetter, language }

    const presenceRef = ref(rtdb, 'presence')
    const unsubPresence = onValue(
      presenceRef,
      (snapshot) => {
        const data = snapshot.val()
        const others: OnlineUser[] = data
          ? (Object.values(data) as OnlineUser[]).filter(u => u.user_id !== user.uid)
          : []
        setOnlineUsers([selfUser, ...others])
      },
      (err) => console.error('presence 읽기 실패 (RTDB 규칙 확인 필요):', err)
    )

    return () => {
      remove(userRef).catch(() => {})
      unsubPresence()
    }
  }, [user.uid, profile?.username, profile?.flag, profile?.avatar_letter])

  const t = UI[uiLang]
  const navItems = NAV_META.map((m, i) => ({ ...m, label: t.nav[i] }))
  const avatarLetter = profile?.avatar_letter ?? user.email?.[0]?.toUpperCase() ?? 'U'

  function openModal() {
    if (openingModalRef.current) return
    openingModalRef.current = true
    setShowModal(true)
    setTimeout(() => { openingModalRef.current = false }, 300)
  }

  function closeModal() {
    setShowModal(false)
    openingModalRef.current = false
  }

  async function signOut() {
    await firebaseSignOut(auth)
    router.push('/auth')
  }

  const filtered = posts
    .filter((p) => {
      if (activeCategory && activeCategory !== 'hot' && p.category !== activeCategory) return false
      if (!langFilter[p.language as keyof typeof langFilter]) return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.title.toLowerCase().includes(q) && !(p.body || '').toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      if (sortBy === 'hot') {
        const la = a._likes ?? 0
        const lb = b._likes ?? 0
        if (lb !== la) return lb - la
      }
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return dateB - dateA
    })

  const feedTitle = navItems.find((n) => n.category === activeCategory)?.label ?? t.nav[0]

  if (loading) return <div>Loading Feed...</div>

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <div className="logo-icon">🤖</div>
          <div>{t.logoTitle}<span className="logo-sub">{t.logoSub}</span></div>
        </div>
        <div className="topbar-search">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="lang-switcher">
          {(['ko', 'en', 'zh'] as const).map((l) => (
            <button key={l} className={`lang-btn ${l}${uiLang === l ? ' active' : ''}`} onClick={() => setUiLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="topbar-actions">
          <button
            onClick={() => setIsDark(d => !d)}
            title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 8, width: 34, height: 34, cursor: 'pointer',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text2)', flexShrink: 0,
            }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <NotificationBell
            userId={user.uid}
            userPosts={posts.filter(p => p.user_id === user.uid).map(p => ({ id: p.id, title: p.title }))}
          />
          <div className="avatar-btn" title="프로필 설정" onClick={() => setShowProfileModal(true)} style={{ cursor: 'pointer' }}>
            {avatarLetter}
          </div>
        </div>
      </header>

      <aside className="sidebar">
        <button className="write-btn" onClick={openModal} onTouchEnd={(e) => { e.preventDefault(); openModal() }}>
          {t.write}
        </button>
        <div className="sidebar-section">
          <div className="sidebar-label">{t.main}</div>
          {navItems.slice(0, 2).map((item) => (
            <div key={item.category ?? 'all'} className={`nav-item ${activeCategory === item.category ? 'active' : ''}`}
              onClick={() => { setActiveCategory(item.category); if (item.category === 'hot') setSortBy('hot'); }}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </div>
          ))}
        </div>
        <div className="sidebar-divider" />
        <div className="sidebar-section">
          <div className="sidebar-label">{t.boards}</div>
          {navItems.slice(2).map((item) => (
            <div key={item.category} className={`nav-item ${activeCategory === item.category ? 'active' : ''}`}
              onClick={() => { setActiveCategory(item.category as Category); setSortBy('all'); }}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </div>
          ))}
        </div>
        <div className="sidebar-divider" />
        <div className="sidebar-section">
          <div className="sidebar-label">{t.myInfo}</div>
          <div className="nav-item" style={{ color: 'var(--text2)', fontSize: 12 }}>
            <span className="nav-icon">{profile?.flag ?? '🌍'}</span>{profile?.username ?? user.email}
          </div>
          <div className="nav-item" onClick={signOut}><span className="nav-icon">🚪</span>{t.signOut}</div>
          {(profile?.role === 'admin' || profile?.role === 'staff') && (
            <div className="nav-item" onClick={() => setShowAdminPanel(true)}>
              <span className="nav-icon">🛡️</span>
              {profile.role === 'admin' ? '어드민 패널' : '스탭 패널'}
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <nav className="mobile-cat-bar">
          {navItems.map((item) => (
            <button key={item.category ?? 'all'} className={`mobile-cat-item ${activeCategory === item.category ? 'active' : ''}`}
              onClick={() => { setActiveCategory(item.category as Category | null); if (item.category === 'hot') setSortBy('hot'); else setSortBy('all'); }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="feed-header">
          <div className="feed-title">{feedTitle}</div>
          <div className="filter-tabs">
            <button className={`filter-tab ${sortBy === 'all' ? 'active' : ''}`} onClick={() => setSortBy('all')}>{t.all}</button>
            <button className={`filter-tab ${sortBy === 'hot' ? 'active' : ''}`} onClick={() => setSortBy('hot')}>{t.popular}</button>
            <button className={`filter-tab ${sortBy === 'new' ? 'active' : ''}`} onClick={() => setSortBy('new')}>{t.latest}</button>
          </div>
          <div className="lang-filter">
            {(['ko', 'en', 'zh'] as const).map((lang) => (
              <button key={lang} className={`lf-btn ${lang} ${langFilter[lang] ? 'on' : ''}`} onClick={() => setLangFilter((p) => ({ ...p, [lang]: !p[lang] }))}>
                {lang === 'ko' ? '🇰🇷 KO' : lang === 'en' ? '🇺🇸 EN' : '🇨🇳 ZH'}
              </button>
            ))}
          </div>
        </div>
        <div className="feed">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📭</div>
              <p>{t.emptyLine1}<br />{t.emptyLine2}</p>
            </div>
          ) : (
            filtered.map((post, i) => (
              <PostCard
                key={post.id} post={post} userId={user.uid} uiLang={uiLang}
                currentUserProfile={profile ? { username: profile.username, flag: profile.flag, avatar_letter: profile.avatar_letter } : null}
                currentUserRole={profile?.role}
                animDelay={Math.min(i * 0.05, 0.3)}
              />
            ))
          )}
        </div>
      </main>

      <RightPanel
        stats={liveStats} hotPosts={hotPosts} onlineUsers={onlineUsers} countryDist={countryDist}
        onUserClick={(u) => { if (u.user_id !== user.uid) setChatTarget(u) }}
      />

      <button className={`mobile-fab${showModal ? ' hidden' : ''}`} onClick={openModal} onTouchEnd={(e) => { e.preventDefault(); openModal() }} aria-label="글쓰기">
        ✏️
      </button>

      {/* 모바일 전용 좌측 FAB: 온라인 유저 + 어드민 */}
      <div className="mobile-side-fabs">
        <button
          className="mobile-side-fab"
          style={{ background: '#22c55e', color: '#fff' }}
          onClick={() => setShowMobileOnline(v => !v)}
          title="온라인 사용자"
        >
          👥
        </button>
        {(profile?.role === 'admin' || profile?.role === 'staff') && (
          <button
            className="mobile-side-fab"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={() => setShowAdminPanel(true)}
            title="어드민 패널"
          >
            🛡️
          </button>
        )}
      </div>

      {/* 모바일 온라인 유저 시트 */}
      {showMobileOnline && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setShowMobileOnline(false)}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'var(--surface1)', borderRadius: '20px 20px 0 0',
              padding: '20px 20px 40px',
              maxHeight: '70vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: 'var(--border2)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)', marginBottom: 4 }}>
              👥 지금 온라인 — {onlineUsers.length}명
            </div>
            <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 16 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', marginRight: 5 }} />
              실시간 접속 중
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {onlineUsers.map(u => (
                <div
                  key={u.user_id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 12,
                    background: 'var(--surface2)',
                    cursor: u.user_id !== user.uid ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (u.user_id === user.uid) return
                    setShowMobileOnline(false)
                    setChatTarget(u)
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: u.flag === '🇰🇷' ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)'
                      : u.flag === '🇺🇸' ? 'linear-gradient(135deg,#ef4444,#991b1b)'
                      : u.flag === '🇨🇳' ? 'linear-gradient(135deg,#f59e0b,#b45309)'
                      : 'linear-gradient(135deg,#f77f00,#d62828)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 15, color: '#fff', flexShrink: 0,
                  }}>
                    {u.avatar_letter}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text1)' }}>
                      {u.flag} {u.username}
                      {u.user_id === user.uid && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>(나)</span>}
                    </div>
                  </div>
                  {u.user_id !== user.uid && (
                    <span style={{ fontSize: 12, color: 'var(--accent)' }}>💬 채팅</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showModal && <WriteModal userId={user.uid} userRole={profile?.role} uiLang={uiLang} onClose={closeModal} onPosted={() => {}} />}
      {showProfileModal && profile && (
        <ProfileSettingsModal
          profile={profile}
          uiLang={uiLang}
          onClose={() => setShowProfileModal(false)}
          onSaved={(updated) => { setProfile(updated); setShowProfileModal(false) }}
        />
      )}
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
      {chatTarget && profile && (
        <DirectChatModal
          myUserId={user.uid}
          myUsername={profile.username}
          myAvatarLetter={profile.avatar_letter}
          myLanguage={profile.language}
          targetUserId={chatTarget.user_id}
          targetUsername={chatTarget.username}
          targetAvatarLetter={chatTarget.avatar_letter}
          targetFlag={chatTarget.flag}
          targetLanguage={(chatTarget.language || 'ko') as 'ko' | 'en' | 'zh'}
          onClose={() => setChatTarget(null)}
        />
      )}
    </div>
  )
}

export default function FeedClient(props: Props) {
  return <ToastProvider><FeedInner {...props} /></ToastProvider>
}
