'use client'

import { useEffect, useState } from 'react'

interface Stats {
  posts: number
  members: number
  today: number
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

export default function RightPanel({ stats }: { stats: Stats }) {
  const posts   = useAnimCount(stats.posts)
  const members = useAnimCount(stats.members)
  const today   = useAnimCount(stats.today)

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
            <div className="lang-fill" style={{ width: barsVisible ? '46%' : '0%', background: 'var(--ko)' }} />
          </div>
          <span className="lang-pct">46%</span>
        </div>
        <div className="lang-row">
          <span className="lang-name">🇨🇳 中文</span>
          <div className="lang-track">
            <div className="lang-fill" style={{ width: barsVisible ? '38%' : '0%', background: 'var(--zh)' }} />
          </div>
          <span className="lang-pct">38%</span>
        </div>
        <div className="lang-row">
          <span className="lang-name">🇺🇸 English</span>
          <div className="lang-track">
            <div className="lang-fill" style={{ width: barsVisible ? '16%' : '0%', background: 'var(--en)' }} />
          </div>
          <span className="lang-pct">16%</span>
        </div>
      </div>

      {/* 접속 중 */}
      <div className="widget">
        <div className="widget-title">👥 지금 접속 중</div>
        <div className="user-stack">
          {[
            { l: '김', c: 'av-ko' }, { l: '王', c: 'av-zh' }, { l: 'A', c: 'av-en' },
            { l: 'N', c: '', s: 'linear-gradient(135deg,#f77f00,#d62828)' },
            { l: '박', c: 'av-ko' }, { l: '李', c: 'av-zh' },
            { l: 'S', c: '', s: 'linear-gradient(135deg,#9c36b5,#5f3dc4)' },
            { l: 'J', c: 'av-en' }, { l: '최', c: 'av-ko' }, { l: '陈', c: 'av-zh' },
            { l: 'M', c: '', s: 'linear-gradient(135deg,#0ca678,#087f5b)' },
            { l: '정', c: 'av-ko' },
          ].map((u, i) => (
            <div key={i} className={`mini-av ${u.c}`} style={u.s ? { background: u.s } : {}}>
              {u.l}
            </div>
          ))}
        </div>
        <div className="online-label">
          <span className="online-dot" /> 지금 12명 온라인
        </div>
      </div>

      {/* 인기글 */}
      <div className="widget">
        <div className="widget-title">🔥 이번 주 인기글</div>
        {[
          { title: '삼성SDS AI 인턴십 지원 꿀팁 공유합니다 🙌', flag: '🇰🇷', top: true },
          { title: '📂 머신러닝 개념 정리 요약본 (3개 언어)', flag: '🇰🇷', top: true },
          { title: '첫 학기 후기 — 너무 재밌어요!', flag: '🇻🇳', top: false },
        ].map((item, i) => (
          <div key={i} className="hot-item">
            <div className={`hot-rank ${item.top ? 'top' : ''}`}>{i + 1}</div>
            <div className="hot-title">{item.title} {item.flag}</div>
          </div>
        ))}
      </div>

    </aside>
  )
}
