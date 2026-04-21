import { NextRequest, NextResponse } from 'next/server'

interface ChatMessage {
  sender_name: string
  sender_flag: string
  body: string
  lang: string
  created_at: number
}

interface Member {
  username: string
  flag: string
  language: string
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.CUSTOM_AI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not set' }, { status: 500 })
    }

    const { messages, members, outputLang = 'ko' } = await request.json() as {
      messages: ChatMessage[]
      members: Member[]
      outputLang: string
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: '메시지가 없습니다.' }, { status: 400 })
    }

    const langName: Record<string, string> = { ko: '한국어', en: 'English', zh: '中文' }

    const participantList = members
      .map(m => `${m.flag} ${m.username} (${langName[m.language] ?? m.language})`)
      .join(', ')

    const chatLog = messages
      .map(m => `[${m.sender_flag} ${m.sender_name}]: ${m.body}`)
      .join('\n')

    const date = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const outputLangName = langName[outputLang] ?? '한국어'

    const prompt = `아래는 다국적 멤버들의 실시간 채팅 대화 내용입니다.
이 대화를 바탕으로 간결한 회의록을 ${outputLangName}로 작성해주세요.

회의 날짜: ${date}
참석자: ${participantList}

--- 대화 내용 ---
${chatLog}
--- 끝 ---

다음 JSON 형식으로만 응답하세요:
{
  "title": "회의 제목 (핵심 주제 한 줄)",
  "participants": "참석자 목록 문자열",
  "keyPoints": ["핵심 내용 1", "핵심 내용 2", "핵심 내용 3"],
  "conclusions": ["결론/액션아이템 1", "결론/액션아이템 2"]
}

조건:
- keyPoints는 최대 5개, 각 항목은 한 문장
- conclusions는 최대 3개
- 대화가 짧거나 내용이 없으면 keyPoints에 "대화 내용 없음" 하나만 포함
- 모든 텍스트는 ${outputLangName}로 작성`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[meeting-summary] OpenAI error:', response.status, err)
      return NextResponse.json({ error: '요약 생성 실패' }, { status: 502 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return NextResponse.json({ error: '응답 없음' }, { status: 500 })

    const parsed = JSON.parse(content)
    return NextResponse.json({
      title: parsed.title ?? '회의록',
      participants: parsed.participants ?? participantList,
      keyPoints: parsed.keyPoints ?? [],
      conclusions: parsed.conclusions ?? [],
      date,
    })
  } catch (err: unknown) {
    console.error('[meeting-summary] error:', err)
    return NextResponse.json({ error: '회의록 생성 중 오류' }, { status: 500 })
  }
}
