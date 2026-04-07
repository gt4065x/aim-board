'use client'

import { useEffect, useState } from 'react'

interface Stats {
  posts: number
  members: number
  today: number
  langDist: { ko: number; en: number; zh: number }
}

interface HotPost {
  id: string
  title: string
  language: string
  likes: number
}

interface OnlineUser {
  user_id: string
  username: string
  flag: string
  avatar_letter: string
}

interface CountryCount {
  flag: string
  count: number
}

const LANG_FLAG: Record<string, string> = { ko: '🇰🇷', en: '🇺🇸', zh: '🇨🇳' }

function avatarCls(flag: string) {
  if (flag === '🇰🇷') return 'av-ko'
  if (flag === '🇺🇸') return 'av-en'
  if (flag === '🇨🇳') return 'av-zh'
  return ''
}

function useAnimCount(target: number) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let n = 0
    const step = Math.ceil(target / 40) || 1
    const t = setInterval(() => {
      n = Math.min(n + step, target)
      setVal(n)
      if (n >= target) clearInterval(t)
    }, 30)
    return () => clearInterval(t)
  }, [target])
  return val
}

export default function RightPanel({
  stats, hotPosts, onlineUsers, countryDist
}: {
  stats: Stats
  hotPosts: HotPost[]
  onlineUsers: OnlineUser[]
  countryDist: CountryCount[]
}) {
  const posts   = useAnimCount(stats.posts)
  const members = useAnimCount(stats.members)
  const today   = useAnimCount(stats.today)
  const online  = useAnimCount(onlineUsers.length)

  const [barsVisible, setBarsVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setBarsVisible(true), 400); return () => clearTimeout(t) }, [])

  const maxCountry = countryDist[0]?.count || 1

  return (
    <aside className="right-panel">

      {/* 학과 현황 */}
      <div className="widget">
        <div className="widget-title">📊 학과 현황</div>
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-num">{posts}</div>
            <div className="stat-label">총 게시글</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{members}</div>
            <div className="stat-label">가입 학생</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{today}</div>
            <div className="stat-label">오늘 글</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{online}</div>
            <div className="stat-label">지금 접속</div>
          </div>
        </div>
      </div>

      {/* 국가별 사용자 통계 */}
      <div className="widget">
        <div className="widget-title">🌏 국가별 사용자</div>
        {countryDist.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 0 8px' }}>데이터 없음</div>
        ) : (
          countryDist.map(({ flag, count }) => (
            <div key={flag} className="lang-row">
              <span className="lang-name">{flag}</span>
              <div className="lang-track">
                <div
                  className="lang-fill"
                  style={{
                    width: barsVisible ? `${Math.round((count / maxCountry) * 100)}%` : '0%',
                    background: flag === '🇰🇷' ? 'var(--ko)' : flag === '🇺🇸' ? 'var(--en)' : flag === '🇨🇳' ? 'var(--zh)' : 'var(--accent)',
                  }}
                />
              </div>
              <span className="lang-pct">{count}명</span>
            </div>
          ))
        )}
      </div>

      {/* 전체 사용자 현황 */}
      <div className="widget">
        <div className="widget-title">👥 사용자 현황</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{members}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>전체 가입자</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{online}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>지금 온라인</div>
          </div>
        </div>
        {onlineUsers.length > 0 && (
          <div className="user-stack">
            {onlineUsers.slice(0, 12).map((u) => {
              const cls = avatarCls(u.flag)
              return (
                <div
                  key={u.user_id}
                  className={`mini-av ${cls}`}
                  title={u.username}
                  style={!cls ? { background: 'linear-gradient(135deg,#f77f00,#d62828)' } : {}}
                >
                  {u.avatar_letter}
                </div>
              )
            })}
            {onlineUsers.length > 12 && (
              <div className="mini-av" style={{ background: 'var(--surface2)', color: 'var(--text3)', fontSize: 10 }}>
                +{onlineUsers.length - 12}
              </div>
            )}
          </div>
        )}
        <div className="online-label">
          <span className="online-dot" /> 지금 {onlineUsers.length}명 온라인
        </div>
      </div>

      {/* 인기글 (좋아요 순) */}
      <div className="widget">
        <div className="widget-title">🔥 인기글 TOP 5</div>
        {hotPosts.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '6px 0' }}>게시글이 없습니다.</div>
        ) : (
          hotPosts.map((item, i) => (
            <div key={item.id} className="hot-item">
              <div className={`hot-rank ${i < 2 ? 'top' : ''}`}>{i + 1}</div>
              <div className="hot-title" style={{ flex: 1 }}>
                {item.title}
                <span style={{ marginLeft: 4 }}>{LANG_FLAG[item.language] ?? '🌐'}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', marginLeft: 6 }}>
                ❤️ {item.likes}
              </div>
            </div>
          ))
        )}
      </div>

    </aside>
  )
}
