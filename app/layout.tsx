import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI경영학과 커뮤니티 — Woosong',
  description: '우송대학교 AI경영학과 다국어 학생 커뮤니티',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
