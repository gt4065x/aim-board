'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
import { ToastProvider, useToast } from '@/components/Toast'

const NAV_META = [
  { icon: '🏠', category: null,     badge: null, badgeCls: '' },
  { icon: '🔥', category: 'hot',    badge: null, badgeCls: '' },
  { icon: '📢', category: 'notice', badge: null, badgeCls: '' },
  { icon: '💬', category: 'free',   badge: null, badgeCls: '' },
  { icon: '📚', category: 'study',  badge: null, badgeCls: 'blue' },
  { icon: '❓', category: 'qa',     badge: null, badgeCls: 'green' },
  { icon: '💼', category: 'career', badge: null, badgeCls: '' },
  { icon: '📎', category: 'resource', badge: null, badgeCls: '' },
  { icon: '🎉', category: 'event',  badge: null, badgeCls: '' },
]

const UI = {
  ko: {
    write: '✏️ 글쓰기', main: '메인', boards: '게시판', myInfo: '내 정보',
    signOut: '로그아웃', all: '전체', popular: '인기순', latest: '최신순',
    emptyLine1: '게시글이 없습니다.', emptyLine2: '첫 번째 글을 작성해보세요!',
    search: '게시글 검색 / Search / 搜索...',
    nav: ['전체 피드', '인기글', '공지사항', '자유게시판', '스터디 모집', 'Q&A', '취업·인턴', '자료 공유', '학과 이벤트'],
  },
  en: {
    write: '✏️ Write', main: 'Main', boards: 'Boards', myInfo: 'My Info',
    signOut: 'Sign Out', all: 'All', popular: 'Popular', latest: 'Latest',
    emptyLine1: 'No posts yet.', emptyLine2: 'Be the first to write!',
    search: 'Search posts...',
    nav: ['All Feed', 'Popular', 'Notices', 'General', 'Study Group', 'Q&A', 'Jobs & Intern', 'Resources', 'Events'],
  },
  zh: {
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

interface LangDist { ko: number; en: number; zh: number }
interface HotPost { id: string; title: string; language: string; likes: number }
export interface OnlineUser {
  user_id: string; username: string; flag: string; avatar_letter: string;
}

interface Props { user: User }

function FeedInner({ user }: Props) {
  const router = useRouter()
  const { showToast } = useToast()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [liveStats, setLiveStats] = useState({ posts: 0, members: 0, today: 0, langDist: { ko: 33, en: 33, zh: 34 } })
  const [hotPosts, setHotPosts] = useState<HotPost[]>([])
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'new' | 'hot' | 'all'>('all')
  const [langFilter, setLangFilter] = useState({ ko: true, en: true, zh: true })

  const [showModal, setShowModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const openingModalRef = useRef(false)

  const [uiLang, setUiLang] = useState<Language>('ko')
  const [loading, setLoading] = useState(true)

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
          language: lang,
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
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post))
      setPosts(docs)

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
      let ko=0, en=0, zh=0
      snapshot.forEach(d => {
        const l = d.data().language
        if (l==='ko') ko++; else if(l==='en') en++; else if(l==='zh') zh++;
      })
      const total = ko+en+zh || 1
      setLiveStats(prev => ({
        ...prev,
        members,
        langDist: { ko: Math.round(ko/total*100), en: Math.round(en/total*100), zh: Math.round(zh/total*100)}
      }))
    })

    setLoading(false)

    return () => { unsubPosts(); unsubProfiles(); }
  }, [])

  // 3. 실시간 접속자 (Firebase Realtime Database)
  useEffect(() => {
    if (!user || !profile) return
    const userRef = ref(rtdb, `presence/${user.uid}`)

    const setOnline = async () => {
      await onDisconnect(userRef).remove()
      await set(userRef, {
        user_id: user.uid,
        username: profile.username || 'Guest',
        flag: profile.flag || '🌍',
        avatar_letter: profile.avatar_letter || 'U',
        onlineAt: Date.now()
      })
    }
    setOnline()

    const presenceRef = ref(rtdb, 'presence')
    const unsubPresence = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setOnlineUsers(Object.values(data) as OnlineUser[])
      } else {
        setOnlineUsers([])
      }
    })

    return () => {
      remove(userRef)
      unsubPresence()
    }
  }, [user, profile])

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
        if (!p.title.toLowerCase().includes(q) && !(p.body||'').toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return dateB - dateA
    })

  const feedTitle = navItems.find((n) => n.category === activeCategory)?.label ?? t.nav[0]

  if (loading) return <div>Loading Feed...</div>

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <div className="logo-icon">🤖</div>
          <div>AI경영학과<span className="logo-sub">Woosong · Community</span></div>
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
          <div className="notif-btn">🔔<div className="notif-dot" /></div>
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
                animDelay={Math.min(i * 0.05, 0.3)}
              />
            ))
          )}
        </div>
      </main>

      <RightPanel stats={liveStats} hotPosts={hotPosts} onlineUsers={onlineUsers} />

      <button className={`mobile-fab${showModal ? ' hidden' : ''}`} onClick={openModal} onTouchEnd={(e) => { e.preventDefault(); openModal() }} aria-label="글쓰기">
        ✏️
      </button>

      {showModal && <WriteModal userId={user.uid} uiLang={uiLang} onClose={closeModal} onPosted={() => {}} />}
      {showProfileModal && profile && (
        <ProfileSettingsModal
          profile={profile}
          onClose={() => setShowProfileModal(false)}
          onSaved={(updated) => { setProfile(updated); setShowProfileModal(false) }}
        />
      )}
    </div>
  )
}

export default function FeedClient(props: Props) {
  return <ToastProvider><FeedInner {...props} /></ToastProvider>
}
