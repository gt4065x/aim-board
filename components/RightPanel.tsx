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
    const step = Math.ceil(target / 40)
    const t = setInterval(() => {
      n = Math.min(n + step, target)
      setVal(n)
      if (n >= target) clearInterval(t)
    }, 30)
    return () => clearInterval(t)
  }, [target])
  return val
}

export default function RightPanel({ stats, hotPosts, onlineUsers }: { stats: Stats; hotPosts: HotPost[]; onlineUsers: OnlineUser[] }) {
  const posts   = useAnimCount(stats.posts)
  const members = useAnimCount(stats.members)
  const today   = useAnimCount(stats.today)
  const koPct   = useAnimCount(stats.langDist.ko)
  const zhPct   = useAnimCount(stats.langDist.zh)
  const enPct   = useAnimCount(stats.langDist.en)

  const [barsVisible, setBarsVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setBarsVisible(true), 400); return () => clearTimeout(t) }, [])

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
            <div className="stat-num">3</div>
            <div className="stat-label">사용 언어</div>
          </div>
        </div>
      </div>

      {/* 언어 분포 */}
      <div className="widget">
        <div className="widget-title">🌏 언어 분포</div>
        <div className="lang-row">
          <span className="lang-name">🇰🇷 한국어</span>
          <div className="lang-track">
            <div className="lang-fill" style={{ width: barsVisible ? `${stats.langDist.ko}%` : '0%', background: 'var(--ko)' }} />
          </div>
          <span className="lang-pct">{koPct}%</span>
        </div>
        <div className="lang-row">
          <span className="lang-name">🇨🇳 中文</span>
          <div className="lang-track">
            <div className="lang-fill" style={{ width: barsVisible ? `${stats.langDist.zh}%` : '0%', background: 'var(--zh)' }} />
          </div>
          <span className="lang-pct">{zhPct}%</span>
        </div>
        <div className="lang-row">
          <span className="lang-name">🇺🇸 English</span>
          <div className="lang-track">
            <div className="lang-fill" style={{ width: barsVisible ? `${stats.langDist.en}%` : '0%', background: 'var(--en)' }} />
          </div>
          <span className="lang-pct">{enPct}%</span>
        </div>
      </div>

      {/* 접속 중 */}
      <div className="widget">
        <div className="widget-title">👥 지금 접속 중</div>
        {onlineUsers.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 0 8px' }}>접속 중인 사용자가 없습니다.</div>
        ) : (
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

      {/* 인기글 */}
      <div className="widget">
        <div className="widget-title">🔥 이번 주 인기글</div>
        {hotPosts.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '6px 0' }}>이번 주 게시글이 없습니다.</div>
        ) : (
          hotPosts.map((item, i) => (
            <div key={item.id} className="hot-item">
              <div className={`hot-rank ${i < 2 ? 'top' : ''}`}>{i + 1}</div>
              <div className="hot-title">
                {item.title}
                <span style={{ marginLeft: 4 }}>{LANG_FLAG[item.language] ?? '🌐'}</span>
              </div>
            </div>
          ))
        )}
      </div>

    </aside>
  )
}
