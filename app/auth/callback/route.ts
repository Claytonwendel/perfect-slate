// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Exchange code for session
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && session) {
      // User is now logged in!
      // Create their profile if it doesn't exist
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', session.user.id)
        .single()
      
      if (!profile) {
        // Create profile
        await supabase.from('users').insert({
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          total_earnings: 0,
          earnings_total: 0,
          balance: 0,
          perfect_slates: 0,
          total_slates_submitted: 0,
          total_slates: 0,
          win_percentage: 0,
          win_rate: 0,
          bad_beats_9: 0,
          bad_beats_8: 0,
          current_streak: 0,
          longest_streak: 0,
          streak_days: 0,
          streak_current: 0,
          token_balance: 1,
          lifetime_tokens_earned: 1,
          lifetime_tokens_used: 0,
          slates_toward_next_token: 0,
          is_active: true,
          is_verified: true,
          verified: true,
          verification_status: 'verified',
          notification_preferences: {},
          favorite_sport: 'MLB'
        })
      }
      
      // Redirect to home with success flag
      return NextResponse.redirect(new URL('/?verified=true', requestUrl.origin))
    }
  }

  // Something went wrong
  return NextResponse.redirect(new URL('/?error=auth', requestUrl.origin))
}
