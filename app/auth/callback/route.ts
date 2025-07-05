// app/auth/callback/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
      // Check if profile exists (in case trigger didn't fire)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle()
      
      // Create profile if it doesn't exist
      if (!profile) {
        const username = requestUrl.searchParams.get('username') || 
                        session.user.email?.split('@')[0] || 
                        'player'
        
        try {
          await supabase.from('user_profiles').insert({
            id: session.user.id,
            email: session.user.email,
            username: username,
            token_balance: 1,
            lifetime_tokens_earned: 1,
            is_verified: true
          })
        } catch (insertError) {
          // If username conflict, try with unique username
          const uniqueUsername = `${username}${Date.now()}`
          await supabase.from('user_profiles').insert({
            id: session.user.id,
            email: session.user.email,
            username: uniqueUsername,
            token_balance: 1,
            lifetime_tokens_earned: 1,
            is_verified: true
          })
        }
      }
      
      // Redirect to home with success flag
      return NextResponse.redirect(new URL('/?verified=true', requestUrl.origin))
    } else {
      // Auth failed
      return NextResponse.redirect(new URL('/?error=auth_failed', requestUrl.origin))
    }
  }
  
  // No auth params provided
  return NextResponse.redirect(new URL('/?error=no_params', requestUrl.origin))
}
