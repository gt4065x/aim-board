export type Language = 'ko' | 'en' | 'zh'
export type Category = 'free' | 'qa' | 'study' | 'career' | 'resource' | 'event' | 'notice'
export type Role = 'student' | 'professor'

export interface Profile {
  id: string
  username: string
  flag: string
  role: Role
  avatar_letter: string
  language: Language
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  title: string
  body: string
  category: Category
  language: Language
  pinned: boolean
  created_at: string
  profiles?: Profile
  likes?: { count: number }[]
  comments?: { count: number }[]
  user_liked?: boolean
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
  profiles?: Profile
}

export interface Like {
  id: string
  post_id: string
  user_id: string
}
