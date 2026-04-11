'use client'

import { useEffect, useState } from 'react'

const QUOTES = [
  { text: "인생은 자전거를 타는 것과 같다. 균형을 잡으려면 계속 움직여야 한다.", author: "알베르트 아인슈타인", en: "Albert Einstein" },
  { text: "천 리 길도 한 걸음부터.", author: "노자", en: "Laozi" },
  { text: "당신이 할 수 있다고 생각하든, 할 수 없다고 생각하든, 당신은 옳다.", author: "헨리 포드", en: "Henry Ford" },
  { text: "넘어지는 것이 실패가 아니다. 넘어진 자리에 머무르는 것이 실패다.", author: "소크라테스", en: "Socrates" },
  { text: "지식에 투자하는 것이 가장 높은 이익을 가져다 준다.", author: "벤저민 프랭클린", en: "Benjamin Franklin" },
  { text: "어리석은 자는 멀리서 행복을 찾고, 현명한 자는 자신의 발치에서 행복을 키운다.", author: "제임스 오펜하임", en: "James Oppenheim" },
  { text: "성공은 열정을 잃지 않고 실패를 거듭할 수 있는 능력이다.", author: "윈스턴 처칠", en: "Winston Churchill" },
  { text: "자신을 알라.", author: "소크라테스", en: "Socrates" },
  { text: "꿈을 꿀 수 있다면, 그 꿈을 이룰 수도 있다.", author: "월트 디즈니", en: "Walt Disney" },
  { text: "교육은 세상을 바꾸는 데 사용할 수 있는 가장 강력한 무기다.", author: "넬슨 만델라", en: "Nelson Mandela" },
  { text: "오늘 할 수 있는 일을 내일로 미루지 마라.", author: "벤저민 프랭클린", en: "Benjamin Franklin" },
  { text: "가장 어두운 밤도 끝나고 태양은 떠오를 것이다.", author: "빅토르 위고", en: "Victor Hugo" },
  { text: "당신의 시간은 한정되어 있다. 다른 사람의 삶을 사느라 낭비하지 마라.", author: "스티브 잡스", en: "Steve Jobs" },
  { text: "우리가 두려워해야 할 것은 두려움 그 자체뿐이다.", author: "프랭클린 D. 루스벨트", en: "Franklin D. Roosevelt" },
  { text: "배움에는 끝이 없다. 모든 것이 스승이다.", author: "레오나르도 다 빈치", en: "Leonardo da Vinci" },
  { text: "행동이 항상 행복을 가져다주지는 않지만, 행동 없이는 행복이 없다.", author: "벤저민 디즈레일리", en: "Benjamin Disraeli" },
]

function getWeeklyQuote() {
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  return QUOTES[weekIndex % QUOTES.length]
}

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
  stats, hotPosts, onlineUsers, countryDist, onUserClick
}: {
  stats: Stats
  hotPosts: HotPost[]
  onlineUsers: OnlineUser[]
  countryDist: CountryCount[]
  onUserClick?: (user: OnlineUser) => void
}) {
  const posts   = useAnimCount(stats.posts)
  const members = useAnimCount(stats.members)
  const today   = useAnimCount(stats.today)
  const online  = useAnimCount(onlineUsers.length)

  const [barsVisible, setBarsVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setBarsVisible(true), 400); return () => clearTimeout(t) }, [])

  const maxCountry = countryDist[0]?.count || 1
  const quote = getWeeklyQuote()
  const weekNum = (Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % 16) + 1

  return (
    <aside className="right-panel">

      {/* 이주의 명언 */}
      <div className="widget" style={{ background: 'linear-gradient(135deg, var(--surface2) 0%, var(--surface) 100%)', borderLeft: '3px solid var(--accent)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>WEEK {weekNum} / 16</div>
        <div className="widget-title" style={{ marginBottom: 10 }}>💬 이주의 명언</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text1)', fontStyle: 'italic', marginBottom: 10 }}>
          &ldquo;{quote.text}&rdquo;
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 24, height: 2, background: 'var(--accent)', borderRadius: 2 }} />
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{quote.author}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>({quote.en})</span>
          </div>
        </div>
      </div>

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
                  title={`${u.username} — 클릭해서 채팅`}
                  onClick={() => onUserClick?.(u)}
                  style={{
                    ...(!cls ? { background: 'linear-gradient(135deg,#f77f00,#d62828)' } : {}),
                    cursor: onUserClick ? 'pointer' : 'default',
                  }}
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
