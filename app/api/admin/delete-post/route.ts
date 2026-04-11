import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // 1. 요청자 인증
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증 토큰이 없습니다.' }, { status: 401 })
  }

  let callerUid: string
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7))
    callerUid = decoded.uid
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
  }

  // 2. admin 권한 확인
  const callerSnap = await getAdminDb().collection('profiles').doc(callerUid).get()
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 3. 삭제할 post ID 파싱
  let postId: string
  try {
    const body = await request.json()
    postId = body.postId
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  if (!postId) {
    return NextResponse.json({ error: 'postId가 필요합니다.' }, { status: 400 })
  }

  // 4. 삭제
  await getAdminDb().collection('posts').doc(postId).delete()

  return NextResponse.json({ success: true, postId })
}
