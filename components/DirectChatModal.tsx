'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ref, push, onValue, off, set, remove } from 'firebase/database'
import { rtdb } from '@/lib/firebase/client'
import type { Language } from '@/lib/types'

interface Message {
  id: string
  sender_id: string
  body: string
  lang: Language
  created_at: number
}

interface Props {
  myUserId: string
  myUsername: string
  myAvatarLetter: string
  myFlag: string
  myLanguage: Language
  targetUserId: string
  targetUsername: string
  targetAvatarLetter: string
  targetFlag: string
  targetLanguage: Language
  onClose: () => void
}

function getChatId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join('_')
}

export default function DirectChatModal({
  myUserId, myUsername, myAvatarLetter, myFlag, myLanguage,
  targetUserId, targetUsername, targetAvatarLetter, targetFlag, targetLanguage,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  // msgId → 번역된 텍스트 캐시
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [translating, setTranslating] = useState<Record<string, boolean>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const needsTranslation = myLanguage !== targetLanguage

  const chatId = getChatId(myUserId, targetUserId)
  const chatRef = ref(rtdb, `dms/${chatId}`)
  const inviteRef = ref(rtdb, `chat_invites/${targetUserId}`)

  // 채팅창 열릴 때 상대방에게 초대 알림 전송, 닫힐 때 제거
  useEffect(() => {
    set(inviteRef, {
      from_uid: myUserId,
      from_username: myUsername,
      from_avatar: myAvatarLetter,
      from_flag: myFlag,
      chat_id: chatId,
      at: Date.now(),
    }).catch(() => {})
    return () => {
      remove(inviteRef).catch(() => {})
    }
  }, [chatId])

  useEffect(() => {
    const listener = onValue(chatRef, (snap) => {
      const val = snap.val()
      if (!val) { setMessages([]); return }
      const msgs: Message[] = Object.entries(val).map(([id, m]: [string, any]) => ({
        id,
        sender_id: m.sender_id,
        body: m.body,
        lang: m.lang ?? 'ko',
        created_at: m.created_at ?? 0,
      }))
      msgs.sort((a, b) => a.created_at - b.created_at)
      setMessages(msgs)
    })
    return () => off(chatRef, 'value', listener)
  }, [chatId])

  // 번역이 필요한 메시지 자동 번역
  useEffect(() => {
    if (!needsTranslation) return
    messages.forEach((msg) => {
      const isMe = msg.sender_id === myUserId
      // 상대방 메시지이고 아직 번역 안됨
      if (!isMe && !translations[msg.id] && !translating[msg.id]) {
        translateMessage(msg)
      }
    })
  }, [messages, needsTranslation])

  async function translateMessage(msg: Message) {
    setTranslating(prev => ({ ...prev, [msg.id]: true }))
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
    } catch {
      // 번역 실패 시 원문 표시
    } finally {
      setTranslating(prev => ({ ...prev, [msg.id]: false }))
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, translations])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function send() {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    setInput('')
    try {
      await push(chatRef, {
        sender_id: myUserId,
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

  const LANG_LABEL: Record<Language, string> = { ko: '한국어', en: 'English', zh: '中文' }

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
          background: 'var(--surface1)', border: '1px solid var(--border1)',
          borderRadius: 16, width: '100%', maxWidth: 480,
          height: 560, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border1)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg,#667eea,#764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 15, color: '#fff', flexShrink: 0,
          }}>
            {targetAvatarLetter}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)' }}>
              {targetFlag} {targetUsername}
            </div>
            {needsTranslation ? (
              <div style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                🌐 {LANG_LABEL[targetLanguage]} → {LANG_LABEL[myLanguage]} 자동번역
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                온라인
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
              color: 'var(--text2)', fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* 메시지 목록 */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {messages.length === 0 && (
            <div style={{
              textAlign: 'center', color: 'var(--text3)', fontSize: 13,
              marginTop: 'auto', marginBottom: 'auto',
            }}>
              {targetUsername}님과 대화를 시작해보세요 👋
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === myUserId
            const translatedBody = !isMe && needsTranslation ? translations[msg.id] : null
            const isTranslating = !isMe && needsTranslation && translating[msg.id]

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
                    background: 'linear-gradient(135deg,#667eea,#764ba2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 12, color: '#fff',
                  }}>
                    {targetAvatarLetter}
                  </div>
                )}
                <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 3 }}>
                  <div style={{
                    padding: '8px 12px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
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
                  {/* 번역됨 표시 + 원문 토글 */}
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

        {/* 입력창 */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid var(--border1)',
          display: 'flex', gap: 8,
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
