import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('[translate] OPENAI_API_KEY not set')
      return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
    }

    const { title, body, targetLang = 'ko' } = await request.json()

    if (!title && !body) {
      return NextResponse.json({ error: '번역할 내용이 없습니다.' }, { status: 400 })
    }

    const langName: Record<string, string> = {
      ko: '한국어',
      en: '영어',
      zh: '중국어',
    }

    const prompt = `다음 게시글의 제목과 본문을 ${langName[targetLang] ?? '한국어'}로 자연스럽게 번역해주세요.
원문의 뉘앙스와 의미를 최대한 살려서 번역하고, 아래 JSON 형식으로만 응답해주세요:
{"title": "번역된 제목", "body": "번역된 본문"}

제목: ${title}
본문: ${body}`

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
      console.error('[translate] OpenAI API error:', response.status, err)
      return NextResponse.json(
        { error: `번역 요청 실패 (${response.status})` },
        { status: 502 }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.error('[translate] Empty response from OpenAI:', data)
      return NextResponse.json({ error: '번역 응답이 비어있습니다.' }, { status: 500 })
    }

    const parsed = JSON.parse(content)
    return NextResponse.json({
      title: parsed.title ?? title,
      body: parsed.body ?? body,
    })
  } catch (err: unknown) {
    console.error('[translate] Unhandled error:', err)
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: `번역 중 오류: ${message}` }, { status: 500 })
  }
}
