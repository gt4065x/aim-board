'use client'

import { useEffect, useState } from 'react'

type Lang = 'ko' | 'en' | 'zh'

const QUOTES: Record<Lang, { text: string; author: string }[]> = {
  ko: [
    { text: "인생은 자전거를 타는 것과 같다. 균형을 잡으려면 계속 움직여야 한다.", author: "알베르트 아인슈타인" },
    { text: "천 리 길도 한 걸음부터.", author: "노자" },
    { text: "당신이 할 수 있다고 생각하든, 할 수 없다고 생각하든, 당신은 옳다.", author: "헨리 포드" },
    { text: "넘어지는 것이 실패가 아니다. 넘어진 자리에 머무르는 것이 실패다.", author: "소크라테스" },
    { text: "지식에 투자하는 것이 가장 높은 이익을 가져다 준다.", author: "벤저민 프랭클린" },
    { text: "성공은 열정을 잃지 않고 실패를 거듭할 수 있는 능력이다.", author: "윈스턴 처칠" },
    { text: "꿈을 꿀 수 있다면, 그 꿈을 이룰 수도 있다.", author: "월트 디즈니" },
    { text: "오늘 할 수 있는 일을 내일로 미루지 마라.", author: "벤저민 프랭클린" },
  ],
  en: [
    { text: "Life is like riding a bicycle. To keep your balance, you must keep moving.", author: "Albert Einstein" },
    { text: "A journey of a thousand miles begins with a single step.", author: "Laozi" },
    { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
    { text: "Falling is not failure. Staying where you fell is.", author: "Socrates" },
    { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
    { text: "Success is the ability to go from failure to failure without losing enthusiasm.", author: "Winston Churchill" },
    { text: "If you can dream it, you can do it.", author: "Walt Disney" },
    { text: "Don't put off until tomorrow what you can do today.", author: "Benjamin Franklin" },
  ],
  zh: [
    { text: "生活就像骑自行车，要保持平衡，就必须不断前进。", author: "阿尔伯特·爱因斯坦" },
    { text: "千里之行，始于足下。", author: "老子" },
    { text: "不管你认为自己能还是不能，你都是对的。", author: "亨利·福特" },
    { text: "跌倒不是失败，留在跌倒的地方才是失败。", author: "苏格拉底" },
    { text: "投资知识，回报最丰。", author: "本杰明·富兰克林" },
    { text: "成功是在不失去热情的前提下，一次次经历失败的能力。", author: "温斯顿·丘吉尔" },
    { text: "只要你能梦想，你就能实现。", author: "沃尔特·迪士尼" },
    { text: "今日事，今日毕。", author: "本杰明·富兰克林" },
  ],
}

const UI = {
  ko: {
    weeklyQuote: '이주의 명언', week: '주차',
    deptStats: '학과 현황', totalPosts: '총 게시글', members: '가입 학생',
    todayPosts: '오늘 글', nowOnline: '지금 접속',
    countryUsers: '국가별 사용자', noData: '데이터 없음', persons: '명',
    userStats: '사용자 현황', totalMembers: '전체 가입자', onlineNow: '지금 온라인',
    onlineLabel: (n: number) => `지금 ${n}명 온라인`,
    chatTooltip: '클릭해서 채팅', hotPosts: '인기글 TOP 5', noPosts: '게시글이 없습니다.',
  },
  en: {
    weeklyQuote: "Week's Quote", week: 'WK',
    deptStats: 'Dept. Stats', totalPosts: 'Posts', members: 'Members',
    todayPosts: 'Today', nowOnline: 'Online',
    countryUsers: 'Users by Country', noData: 'No data', persons: '',
    userStats: 'User Stats', totalMembers: 'Total Members', onlineNow: 'Online Now',
    onlineLabel: (n: number) => `${n} online now`,
    chatTooltip: 'Click to chat', hotPosts: 'Hot Posts TOP 5', noPosts: 'No posts yet.',
  },
  zh: {
    weeklyQuote: '本周名言', week: '周',
    deptStats: '学科概况', totalPosts: '总帖子', members: '注册学生',
    todayPosts: '今日', nowOnline: '在线',
    countryUsers: '各国用户', noData: '暂无数据', persons: '人',
    userStats: '用户概况', totalMembers: '全部会员', onlineNow: '当前在线',
    onlineLabel: (n: number) => `当前 ${n} 人在线`,
    chatTooltip: '点击聊天', hotPosts: '热门帖子 TOP 5', noPosts: '暂无帖子。',
  },
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
    const timer = setInterval(() => {
      n = Math.min(n + step, target)
      setVal(n)
      if (n >= target) clearInterval(timer)
    }, 30)
    return () => clearInterval(timer)
  }, [target])
  return val
}

interface Stats { posts: number; members: number; today: number; langDist: { ko: number; en: number; zh: number } }
interface HotPost { id: string; title: string; language: string; likes: number }
interface OnlineUser { user_id: string; username: string; flag: string; avatar_letter: string }
interface CountryCount { flag: string; count: number }

export default function RightPanel({
  stats, hotPosts, onlineUsers, countryDist, onUserClick, uiLang = 'ko',
}: {
  stats: Stats
  hotPosts: HotPost[]
  onlineUsers: OnlineUser[]
  countryDist: CountryCount[]
  onUserClick?: (user: OnlineUser) => void
  uiLang?: Lang
}) {
  const t = UI[uiLang]
  const posts   = useAnimCount(stats.posts)
  const members = useAnimCount(stats.members)
  const today   = useAnimCount(stats.today)
  const online  = useAnimCount(onlineUsers.length)

  const [barsVisible, setBarsVisible] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setBarsVisible(true), 400); return () => clearTimeout(timer) }, [])

  const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  const quote = QUOTES[uiLang][weekIndex % QUOTES[uiLang].length]
  const weekNum = (weekIndex % 16) + 1
  const maxCountry = countryDist[0]?.count || 1

  return (
    <aside className="right-panel">

      {/* 이주의 명언 */}
      <div className="widget" style={{ background: 'linear-gradient(135deg, var(--surface2) 0%, var(--surface) 100%)', borderLeft: '3px solid var(--accent)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>
          {t.week} {weekNum} / 16
        </div>
        <div className="widget-title" style={{ marginBottom: 10 }}>💬 {t.weeklyQuote}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text1)', fontStyle: 'italic', marginBottom: 10 }}>
          &ldquo;{quote.text}&rdquo;
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 24, height: 2, background: 'var(--accent)', borderRadius: 2 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{quote.author}</span>
        </div>
      </div>

      {/* 학과 현황 */}
      <div className="widget">
        <div className="widget-title">📊 {t.deptStats}</div>
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-num">{posts}</div>
            <div className="stat-label">{t.totalPosts}</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{members}</div>
            <div className="stat-label">{t.members}</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{today}</div>
            <div className="stat-label">{t.todayPosts}</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{online}</div>
            <div className="stat-label">{t.nowOnline}</div>
          </div>
        </div>
      </div>

      {/* 국가별 사용자 */}
      <div className="widget">
        <div className="widget-title">🌏 {t.countryUsers}</div>
        {countryDist.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 0 8px' }}>{t.noData}</div>
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
              <span className="lang-pct">{count}{t.persons}</span>
            </div>
          ))
        )}
      </div>

      {/* 전체 사용자 현황 */}
      <div className="widget">
        <div className="widget-title">👥 {t.userStats}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{members}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.totalMembers}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{online}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.onlineNow}</div>
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
                  title={`${u.username} — ${t.chatTooltip}`}
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
          <span className="online-dot" /> {t.onlineLabel(onlineUsers.length)}
        </div>
      </div>

      {/* 인기글 TOP 5 */}
      <div className="widget">
        <div className="widget-title">🔥 {t.hotPosts}</div>
        {hotPosts.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '6px 0' }}>{t.noPosts}</div>
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
