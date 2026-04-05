import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FeedClient from './FeedClient'

type LikeRow = {
  post_id: string
}

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // 현재 사용자 프로필
  const { data: profile, error: profileError } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('profile fetch error:', profileError)
  }

  // 게시글 목록
  const { data: posts, error: postsError } = await (supabase as any)
    .from('posts')
    .select(`
      *,
      profiles (id, username, flag, role, avatar_letter),
      likes (count),
      comments (count)
    `)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30)

  if (postsError) {
    console.error('posts fetch error:', postsError)
  }

  // 내가 좋아요한 게시글 IDs
  const { data: myLikes, error: likesError } = await (supabase as any)
    .from('likes')
    .select('post_id')
    .eq('user_id', user.id)

  if (likesError) {
    console.error('myLikes fetch error:', likesError)
  }

  const likedRows = (myLikes ?? []) as LikeRow[]
  const likedIds = new Set(likedRows.map((l) => l.post_id))

  const postRows = (posts ?? []) as any[]

  const postsWithLike = postRows.map((p) => ({
    ...p,
    user_liked: likedIds.has(p.id),
  }))

  // 통계
  const { count: postCount, error: postCountError } = await (supabase as any)
    .from('posts')
    .select('*', { count: 'exact', head: true })

  if (postCountError) {
    console.error('post count error:', postCountError)
  }

  const { count: memberCount, error: memberCountError } = await (supabase as any)
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  if (memberCountError) {
    console.error('member count error:', memberCountError)
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count: todayCount, error: todayCountError } = await (supabase as any)
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString())

  if (todayCountError) {
    console.error('today count error:', todayCountError)
  }

  return (
    <FeedClient
      user={user}
      profile={profile}
      initialPosts={postsWithLike}
      stats={{
        posts: postCount ?? 0,
        members: memberCount ?? 0,
        today: todayCount ?? 0,
      }}
    />
  )
}