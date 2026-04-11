import * as admin from 'firebase-admin';

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.app();

  // Firebase App Hosting: FIREBASE_CONFIG가 시스템에서 자동 주입됨 → ADC 사용
  if (process.env.FIREBASE_CONFIG) {
    return admin.initializeApp();
  }

  // 로컬 개발: 명시적 서비스 계정 사용
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export function getAdminDb() {
  return getApp().firestore();
}

export function getAdminAuth() {
  return getApp().auth();
}
