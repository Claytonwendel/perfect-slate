// app/auth/callback/route.ts - DEBUG VERSION
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log('🔄 Callback route hit!')
  
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const username = requestUrl.searchParams.get('username')
  
  console.log('📝 Code:', code ? 'EXISTS' : 'MISSING')
  console.log('📝 Username:', username)
  
  if (code) {
    try {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      
      console.log('🔄 Exchanging code for session...')
      
      // Exchange code for session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('❌ Auth exchange error:', error)
        return NextResponse.redirect(new URL('/?error=auth_exchange', requestUrl.origin))
      }
      
      if (!data.session) {
        console.error('❌ No session returned')
        return NextResponse.redirect(new URL('/?error=no_session', requestUrl.origin))
      }
      
      console.log('✅ Session created for:', data.session.user.email)
      
      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', data.session.user.id)
        .maybeSingle()
      
      console.log('👤 Profile check:', profile ? 'EXISTS' : 'MISSING')
      
      // Create profile if it doesn't exist
      if (!profile) {
        console.log('🔄 Creating user profile...')
        
        const profileUsername = username || 
                               data.session.user.email?.split('@')[0] || 
                               'player'
        
        const { error: insertError } = await supabase.from('user_profiles').insert({
          id: data.session.user.id,
          email: data.session.user.email,
          username: profileUsername,
          token_balance: 1,
          lifetime_tokens_earned: 1,
          is_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          total_earnings: 0,
          perfect_slates: 0,
          total_slates_submitted: 0,
          win_percentage: 0,
          current_streak: 0,
          longest_streak: 0,
          lifetime_tokens_used: 0,
          is_active: true,
          favorite_sport: 'MLB'
        })
        
        if (insertError) {
          console.error('❌ Profile creation error:', insertError)
          // Try with unique username
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
            perfect_slates: 0,
            total_slates_submitted: 0,
            win_percentage: 0,
            current_streak: 0,
            longest_streak: 0,
            lifetime_tokens_used: 0,
            is_active: true,
            favorite_sport: 'MLB'
          })
        }
        
        console.log('✅ Profile created')
      }
      
      console.log('🔄 Redirecting to home with verified=true')
      
      // Redirect to home with success flag
      return NextResponse.redirect(new URL('/?verified=true', requestUrl.origin))
      
    } catch (error) {
      console.error('❌ Callback error:', error)
      return NextResponse.redirect(new URL('/?error=callback_exception', requestUrl.origin))
    }
  }
  
  console.log('❌ No code parameter found')
  // No code parameter
  return NextResponse.redirect(new URL('/?error=no_code', requestUrl.origin))
}
