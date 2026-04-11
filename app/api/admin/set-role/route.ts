import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin'
import type { Role } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_ROLES: Role[] = ['student', 'professor', 'staff', 'admin']

export async function POST(request: NextRequest) {
  // 1. 요청자 인증
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증 토큰이 없습니다.' }, { status: 401 })
  }

  const idToken = authHeader.slice(7)
  let callerUid: string
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    callerUid = decoded.uid
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
  }

  // 2. 요청자가 admin인지 확인
  const callerSnap = await getAdminDb().collection('profiles').doc(callerUid).get()
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다. 어드민만 역할을 변경할 수 있습니다.' }, { status: 403 })
  }

  // 3. 요청 바디 파싱
  let targetUserId: string, role: Role
  try {
    const body = await request.json()
    targetUserId = body.targetUserId
    role = body.role
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  if (!targetUserId || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `유효하지 않은 값입니다. role은 ${VALID_ROLES.join(', ')} 중 하나여야 합니다.` },
      { status: 400 }
    )
  }

  // 4. 대상 유저가 존재하는지 확인
  const targetSnap = await getAdminDb().collection('profiles').doc(targetUserId).get()
  if (!targetSnap.exists) {
    return NextResponse.json({ error: '대상 유저를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 5. 역할 업데이트
  await getAdminDb().collection('profiles').doc(targetUserId).update({ role })

  return NextResponse.json({
    success: true,
    targetUserId,
    role,
    updatedBy: callerUid,
  })
}
