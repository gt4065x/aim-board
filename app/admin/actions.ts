'use server'

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'

export async function adminUpdateUserPassword(uid: string, newPassword: string) {
  try {
    await getAdminAuth().updateUser(uid, { password: newPassword })
    return { success: true }
  } catch (error: any) {
    console.error('[AdminAction] Password update failed:', error)
    return { success: false, error: error.message }
  }
}

export async function adminCreateUser(email: string, username: string) {
  try {
    const userRecord = await getAdminAuth().createUser({
      email,
      password: 'woosong1234',
      displayName: username,
    })

    const newProfile = {
      id: userRecord.uid,
      username,
      flag: '🇰🇷',
      language: 'ko',
      avatar_letter: username[0].toUpperCase(),
      role: 'student',
      created_at: new Date().toISOString(),
    }

    await getAdminDb().collection('profiles').doc(userRecord.uid).set(newProfile)

    return { success: true, uid: userRecord.uid }
  } catch (error: any) {
    console.error('[AdminAction] User creation failed:', error)
    return { success: false, error: error.message }
  }
}
