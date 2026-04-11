import * as admin from 'firebase-admin';

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.app();
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
