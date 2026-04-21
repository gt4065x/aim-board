'use client'

import { useState, useEffect, useRef } from 'react'
import { ref, push, onValue, off, set, remove } from 'firebase/database'
import { rtdb } from '@/lib/firebase/client'
import type { Language } from '@/lib/types'

interface Message {
  id: string
  sender_id: string
  sender_name: string
  sender_flag: string
  body: string
  lang: Language
  created_at: number
}

interface Member {
  user_id: string
  username: string
  flag: string
  avatar_letter: string
  language: Language
}

interface OnlineUser {
  user_id: string
  username: string
  flag: string
  avatar_letter: string
  language?: string
}

interface Props {
  myUserId: string
  myUsername: string
  myAvatarLetter: string
  myFlag: string
  myLanguage: Language
  roomId: string
  onlineUsers: OnlineUser[]
  onClose: () => void
}

const LANG_LABEL: Record<Language, string> = { ko: '한국어', en: 'English', zh: '中文' }

function avatarGradient(flag: string) {
  if (flag === '🇰🇷') return 'linear-gradient(135deg,#3b82f6,#1d4ed8)'
  if (flag === '🇺🇸') return 'linear-gradient(135deg,#ef4444,#991b1b)'
  if (flag === '🇨🇳') return 'linear-gradient(135deg,#f59e0b,#b45309)'
  return 'linear-gradient(135deg,#667eea,#764ba2)'
}

export default function GroupChatModal({
  myUserId, myUsername, myAvatarLetter, myFlag, myLanguage,
  roomId, onlineUsers, onClose,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [members, setMembers] = useState<Record<string, Member>>({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set())
  const [showInvite, setShowInvite] = useState(false)
  const [selectedInvites, setSelectedInvites] = useState<Set<string>>(new Set())
  const [inviting, setInviting] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [summary, setSummary] = useState<{
    title: string; participants: string; keyPoints: string[]; conclusions: string[]; date: string
  } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const requestedRef = useRef<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inviteRef = useRef<HTMLDivElement>(null)

  const messagesRef = ref(rtdb, `rooms/${roomId}/messages`)
  const membersRef = ref(rtdb, `rooms/${roomId}/members`)

  // 방 입장 및 퇴장
  useEffect(() => {
    const myMemberRef = ref(rtdb, `rooms/${roomId}/members/${myUserId}`)
    set(myMemberRef, {
      user_id: myUserId,
      username: myUsername,
      flag: myFlag,
      avatar_letter: myAvatarLetter,
      language: myLanguage,
      joined_at: Date.now(),
    }).catch(console.error)
    return () => { remove(myMemberRef).catch(() => {}) }
  }, [roomId, myUserId])

  // 멤버 목록 리스닝
  useEffect(() => {
    const listener = onValue(membersRef, (snap) => {
      setMembers(snap.val() ?? {})
    })
    return () => off(membersRef, 'value', listener)
  }, [roomId])

  // 초대 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!showInvite) return
    function handleOutside(e: MouseEvent) {
      if (inviteRef.current && !inviteRef.current.contains(e.target as Node)) {
        setShowInvite(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showInvite])

  async function translateMessage(msg: Message) {
    setTranslatingIds(prev => new Set(prev).add(msg.id))
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', body: msg.body, targetLang: myLanguage }),
      })
      const data = await res.json()
      if (data.body && data.body !== msg.body) {
        setTranslations(prev => ({ ...prev, [msg.id]: data.body }))
      }
    } catch {}
    finally {
      setTranslatingIds(prev => { const s = new Set(prev); s.delete(msg.id); return s })
    }
  }

  // 메시지 리스닝 + 자동 번역
  useEffect(() => {
    const listener = onValue(messagesRef, (snap) => {
      const val = snap.val()
      if (!val) { setMessages([]); return }
      const msgs: Message[] = Object.entries(val).map(([id, m]: [string, any]) => ({
        id,
        sender_id: m.sender_id,
        sender_name: m.sender_name ?? '',
        sender_flag: m.sender_flag ?? '',
        body: m.body,
        lang: m.lang ?? 'ko',
        created_at: m.created_at ?? 0,
      }))
      msgs.sort((a, b) => a.created_at - b.created_at)
      setMessages(msgs)
      msgs.forEach((msg) => {
        if (msg.sender_id !== myUserId && msg.lang !== myLanguage && !requestedRef.current.has(msg.id)) {
          requestedRef.current.add(msg.id)
          translateMessage(msg)
        }
      })
    })
    return () => off(messagesRef, 'value', listener)
  }, [roomId, myUserId, myLanguage])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, translations])
  useEffect(() => { inputRef.current?.focus() }, [])

  async function send() {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    setInput('')
    try {
      await push(messagesRef, {
        sender_id: myUserId,
        sender_name: myUsername,
        sender_flag: myFlag,
        body,
        lang: myLanguage,
        created_at: Date.now(),
      })
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function formatTime(ts: number) {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  async function generateSummary() {
    if (messages.length === 0) return
    setSummaryLoading(true)
    setShowSummary(true)
    setSummary(null)
    try {
      const res = await fetch('/api/meeting-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({
            sender_name: m.sender_name,
            sender_flag: m.sender_flag,
            body: m.body,
            lang: m.lang,
            created_at: m.created_at,
          })),
          members: memberList.map(m => ({ username: m.username, flag: m.flag, language: m.language })),
          outputLang: myLanguage,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSummary(data)
    } catch (err) {
      console.error('[meeting-summary]', err)
      setSummary(null)
      setShowSummary(false)
    } finally {
      setSummaryLoading(false)
    }
  }

  function toggleInviteSelect(uid: string) {
    setSelectedInvites(prev => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })
  }

  async function inviteSelected() {
    if (selectedInvites.size === 0 || inviting) return
    setInviting(true)
    const targets = invitableUsers.filter(u => selectedInvites.has(u.user_id))
    await Promise.all(targets.map(u =>
      set(ref(rtdb, `chat_invites/${u.user_id}`), {
        from_uid: myUserId,
        from_username: myUsername,
        from_avatar: myAvatarLetter,
        from_flag: myFlag,
        from_language: myLanguage,
        room_id: roomId,
        at: Date.now(),
      }).catch((err) => console.error('[chat_invite] write failed:', err))
    ))
    setSelectedInvites(new Set())
    setShowInvite(false)
    setInviting(false)
  }

  const memberList = Object.values(members)
  const memberIds = new Set(memberList.map(m => m.user_id))
  const invitableUsers = onlineUsers.filter(u => u.user_id !== myUserId && !memberIds.has(u.user_id))

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          position: 'relative',
          background: 'var(--surface1)', border: '1px solid var(--border1)',
          borderRadius: 16, width: '100%', maxWidth: 520,
          height: 580, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border1)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)', marginBottom: 6 }}>
              💬 그룹 채팅 · {memberList.length}명 참여 중
            </div>
            {/* 멤버 아바타 */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {memberList.map(m => (
                <div
                  key={m.user_id}
                  title={`${m.flag} ${m.username} · ${LANG_LABEL[m.language] ?? m.language}`}
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: avatarGradient(m.flag),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11, color: '#fff',
                    border: m.user_id === myUserId ? '2px solid var(--accent)' : '2px solid transparent',
                    flexShrink: 0, cursor: 'default',
                  }}
                >
                  {m.avatar_letter}
                </div>
              ))}
            </div>
          </div>

          {/* 회의록 버튼 */}
          <button
            onClick={generateSummary}
            disabled={messages.length === 0}
            title="회의록 생성"
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 8, width: 30, height: 30, cursor: messages.length > 0 ? 'pointer' : 'not-allowed',
              color: 'var(--text2)', fontSize: 14, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: messages.length > 0 ? 1 : 0.4,
            }}
          >
            📋
          </button>

          {/* 초대 버튼 */}
          <div ref={inviteRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => { setShowInvite(v => !v); setSelectedInvites(new Set()) }}
              title="참여자 추가"
              style={{
                background: showInvite ? 'var(--accent)' : 'var(--surface2)',
                border: '1px solid var(--border2)',
                borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
                color: showInvite ? '#fff' : 'var(--accent)', fontSize: 20, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              +
            </button>
            {showInvite && (
              <div style={{
                position: 'absolute', top: 36, right: 0,
                background: 'var(--surface1)', border: '1px solid var(--border1)',
                borderRadius: 10, minWidth: 220, zIndex: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', padding: '10px 12px 6px', fontWeight: 600 }}>
                  초대할 사용자 선택
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', padding: '0 8px' }}>
                  {invitableUsers.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 4px 10px' }}>
                      초대 가능한 사용자 없음
                    </div>
                  ) : (
                    invitableUsers.map(u => {
                      const checked = selectedInvites.has(u.user_id)
                      return (
                        <label
                          key={u.user_id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 4px', borderRadius: 7, cursor: 'pointer',
                            background: checked ? 'var(--surface2)' : 'transparent',
                            transition: 'background 0.1s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleInviteSelect(u.user_id)}
                            style={{ accentColor: 'var(--accent)', width: 15, height: 15, flexShrink: 0 }}
                          />
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%',
                            background: avatarGradient(u.flag),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 10, color: '#fff', flexShrink: 0,
                          }}>
                            {u.avatar_letter}
                          </div>
                          <span style={{ flex: 1, fontSize: 13, color: 'var(--text1)' }}>
                            {u.flag} {u.username}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
                {invitableUsers.length > 0 && (
                  <div style={{ padding: '8px 8px 10px', borderTop: '1px solid var(--border1)', display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        const allIds = new Set(invitableUsers.map(u => u.user_id))
                        setSelectedInvites(prev => prev.size === invitableUsers.length ? new Set() : allIds)
                      }}
                      style={{
                        flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer',
                        background: 'var(--surface2)', border: '1px solid var(--border2)',
                        color: 'var(--text2)', fontSize: 12,
                      }}
                    >
                      {selectedInvites.size === invitableUsers.length ? '전체 해제' : '전체 선택'}
                    </button>
                    <button
                      onClick={inviteSelected}
                      disabled={selectedInvites.size === 0 || inviting}
                      style={{
                        flex: 1, padding: '6px 0', borderRadius: 7, cursor: selectedInvites.size > 0 ? 'pointer' : 'not-allowed',
                        background: selectedInvites.size > 0 ? 'var(--accent)' : 'var(--surface2)',
                        border: 'none', color: selectedInvites.size > 0 ? '#fff' : 'var(--text3)',
                        fontWeight: 600, fontSize: 12,
                        opacity: inviting ? 0.6 : 1,
                      }}
                    >
                      {inviting ? '초대 중...' : `${selectedInvites.size > 0 ? selectedInvites.size + '명 ' : ''}초대`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
              color: 'var(--text2)', fontSize: 15, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* 메시지 목록 */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {messages.length === 0 && (
            <div style={{
              textAlign: 'center', color: 'var(--text3)', fontSize: 13,
              marginTop: 'auto', marginBottom: 'auto',
            }}>
              대화를 시작해보세요 👋<br />
              <span style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                메시지는 각자의 언어로 자동 번역됩니다 🌐
              </span>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === myUserId
            const needsTrans = msg.lang !== myLanguage
            const translatedBody = !isMe && needsTrans ? translations[msg.id] : null
            const isTranslating = !isMe && needsTrans && translatingIds.has(msg.id)
            const member = members[msg.sender_id]

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  alignItems: 'flex-end', gap: 8,
                }}
              >
                {!isMe && (
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: avatarGradient(msg.sender_flag),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 12, color: '#fff',
                  }}>
                    {member?.avatar_letter ?? msg.sender_flag[0]}
                  </div>
                )}
                <div style={{
                  maxWidth: '70%', display: 'flex', flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start', gap: 2,
                }}>
                  {!isMe && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', paddingLeft: 2 }}>
                      {msg.sender_flag} {msg.sender_name}
                    </div>
                  )}
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isMe ? 'var(--accent)' : 'var(--surface2)',
                    color: isMe ? '#fff' : 'var(--text1)',
                    fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                    opacity: isTranslating ? 0.6 : 1,
                  }}>
                    {isTranslating ? (
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>번역 중...</span>
                    ) : (
                      translatedBody ?? msg.body
                    )}
                  </div>
                  {translatedBody && (
                    <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 1 }}>
                      🌐 번역됨 · 원문: {msg.body}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* 회의록 오버레이 */}
        {showSummary && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'var(--surface1)', borderRadius: 16,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px', borderBottom: '1px solid var(--border1)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>📋</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)', flex: 1 }}>
                회의록
              </span>
              {summary && (
                <button
                  onClick={() => {
                    const text = `📋 ${summary.title}\n📅 ${summary.date}\n👥 ${summary.participants}\n\n✅ 주요 내용\n${summary.keyPoints.map(p => `• ${p}`).join('\n')}${summary.conclusions.length > 0 ? `\n\n🎯 결론\n${summary.conclusions.map(c => `• ${c}`).join('\n')}` : ''}`
                    navigator.clipboard.writeText(text).catch(() => {})
                  }}
                  style={{
                    background: 'var(--surface2)', border: '1px solid var(--border2)',
                    borderRadius: 7, padding: '4px 10px', cursor: 'pointer',
                    color: 'var(--text2)', fontSize: 12,
                  }}
                >
                  복사
                </button>
              )}
              <button
                onClick={() => setShowSummary(false)}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border2)',
                  borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
                  color: 'var(--text2)', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
              {summaryLoading ? (
                <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginTop: 40 }}>
                  회의록 작성 중...
                </div>
              ) : summary ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)', marginBottom: 4 }}>
                      {summary.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      📅 {summary.date} · 👥 {summary.participants}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>
                      ✅ 주요 내용
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {summary.keyPoints.map((p, i) => (
                        <li key={i} style={{ fontSize: 13, color: 'var(--text1)', lineHeight: 1.5 }}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  {summary.conclusions.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>
                        🎯 결론 / 액션 아이템
                      </div>
                      <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {summary.conclusions.map((c, i) => (
                          <li key={i} style={{ fontSize: 13, color: 'var(--text1)', lineHeight: 1.5 }}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* 입력창 */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border1)',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={`메시지 입력 (${LANG_LABEL[myLanguage]})`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            style={{
              flex: 1, padding: '9px 14px', borderRadius: 10,
              border: '1px solid var(--border2)', background: 'var(--surface2)',
              color: 'var(--text1)', fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            style={{
              padding: '9px 16px', borderRadius: 10,
              background: 'var(--accent)', border: 'none',
              color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !sending ? 1 : 0.5,
              flexShrink: 0,
            }}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  )
}
