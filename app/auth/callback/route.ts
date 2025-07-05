// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const username = requestUrl.searchParams.get('username')
  
  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      // Check if profile exists
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', data.session.user.id)
        .maybeSingle()
      
      // Create profile if it doesn't exist
      if (!profile) {
        const profileUsername = username || 
                               data.session.user.email?.split('@')[0] || 
                               'player'
        
        try {
          await supabase.from('user_profiles').insert({
            id: data.session.user.id,
            email: data.session.user.email,
            username: profileUsername,
            token_balance: 1,
            lifetime_tokens_earned: 1,
            is_verified: true,
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
            lifetime_tokens_used: 0,
            slates_toward_next_token: 0,
            is_active: true,
            verification_status: 'verified',
            verified: true,
            notification_preferences: {},
            favorite_sport: 'MLB'
          })
        } catch (insertError) {
          console.error('Profile creation error:', insertError)
          // If username conflict, try with unique username
          const uniqueUsername = `${profileUsername}${Date.now()}`
          await supabase.from('user_profiles').insert({
            id: data.session.user.id,
            email: data.session.user.email,
            username: uniqueUsername,
            token_balance: 1,
            lifetime_tokens_earned: 1,
            is_verified: true,
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
            lifetime_tokens_used: 0,
            slates_toward_next_token: 0,
            is_active: true,
            verification_status: 'verified',
            verified: true,
            notification_preferences: {},
            favorite_sport: 'MLB'
          })
        }
      }
      
      // Redirect to home with success flag
      return NextResponse.redirect(new URL('/?verified=true', requestUrl.origin))
    }
  }
  
  // Auth failed or no code
  return NextResponse.redirect(new URL('/?error=auth', requestUrl.origin))
}
