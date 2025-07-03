// app/auth/callback/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token = requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')

  if (code || token) {
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    let session = null
    let error = null

    if (code) {
      // OAuth flow
      const result = await supabase.auth.exchangeCodeForSession(code)
      session = result.data.session
      error = result.error
    } else if (token && type === 'magiclink') {
      // Magic link flow
      const result = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink',
      })
      session = result.data.session
      error = result.error
    }
    
    if (!error && session) {
      // User is now logged in!
      // Check if profile exists
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', session.user.id)
        .single()
      
      if (!profile) {
        // Get pending username from the browser (we'll pass it via URL)
        const pendingUsername = requestUrl.searchParams.get('username') || 
                               session.user.email?.split('@')[0] || 
                               'player'
        
        // Create profile
        await supabase.from('users').insert({
          id: session.user.id,
          email: session.user.email,
          username: pendingUsername,
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
      return NextResponse.redirect(new URL('/?welcome=true', requestUrl.origin))
    }
  }

  // Something went wrong
  return NextResponse.redirect(new URL('/?error=auth', requestUrl.origin))
}
