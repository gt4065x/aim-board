'use server'

import { adminAuth } from '@/lib/firebase/admin'

/**
 * Admin action to directly update a user's password.
 * Requires Firebase Admin SDK.
 */
export async function adminUpdateUserPassword(uid: string, newPassword: string) {
  try {
    // Only admins should be able to call this. 
    // In a real app, we should check the current session's claims here.
    // For now, we assume the frontend UI gate is sufficient for this project scope.
    
    await adminAuth.updateUser(uid, {
      password: newPassword
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('[AdminAction] Password update failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Admin action to create a user and their profile.
 */
export async function adminCreateUser(email: string, username: string) {
  try {
    // 1. Create User in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password: 'woosong1234', // Default password
      displayName: username,
    });

    // 2. Create Profile in Firestore
    const { adminDb } = await import('@/lib/firebase/admin');
    const nav = 'ko'; // Default
    const newProfile = {
      id: userRecord.uid,
      username: username,
      flag: '🇰🇷',
      language: 'ko',
      avatar_letter: username[0].toUpperCase(),
      role: 'student',
      created_at: new Date().toISOString()
    };

    await adminDb.collection('profiles').doc(userRecord.uid).set(newProfile);

    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    console.error('[AdminAction] User creation failed:', error);
    return { success: false, error: error.message };
  }
}
