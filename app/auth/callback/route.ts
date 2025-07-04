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
      const result = await supabase.auth.exchangeCodeForSession(code)
      session = result.data.session
      error = result.error
    } else if (token && type === 'magiclink') {
      const result = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink',
      })
      session = result.data.session
      error = result.error
    }
    
    if (!error && session) {
      // Check if profile exists
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle()
      
      if (!profile) {
        const pendingUsername = requestUrl.searchParams.get('username') || 
                               session.user.email?.split('@')[0] || 
                               'player'
        
        // Simple insert with manual referral code to avoid trigger
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: session.user.id,
            email: session.user.email,
            username: pendingUsername,
            referral_code: `REF${Date.now()}`, // Manual referral code
            token_balance: 1,
            lifetime_tokens_earned: 1,
            is_verified: true
          })
        
        if (insertError) {
          console.error('Insert failed:', insertError)
          if (insertError.code === '23505') { // Username conflict
            const uniqueUsername = `${pendingUsername}${Date.now()}`
            await supabase.from('user_profiles').insert({
              id: session.user.id,
              email: session.user.email,
              username: uniqueUsername,
              referral_code: `REF${Date.now()}`,
              token_balance: 1,
              lifetime_tokens_earned: 1,
              is_verified: true
            })
          }
        }
      }
      
      return NextResponse.redirect(new URL('/?success=true', requestUrl.origin))
    }
  }
  
  return NextResponse.redirect(new URL('/?error=auth', requestUrl.origin))
}
