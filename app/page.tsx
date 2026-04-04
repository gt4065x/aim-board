import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FeedClient from './FeedClient'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // 현재 사용자 프로필
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 게시글 목록 (likes/comments 카운트 포함)
  const { data: posts } = await supabase
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

  // 내가 좋아요한 게시글 IDs
  const { data: myLikes } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', user.id)

  const likedIds = new Set((myLikes ?? []).map(l => l.post_id))

  const postsWithLike = (posts ?? []).map(p => ({
    ...p,
    user_liked: likedIds.has(p.id),
  }))

  // 통계
  const { count: postCount } = await supabase.from('posts').select('*', { count: 'exact', head: true })
  const { count: memberCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const { count: todayCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString())

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
