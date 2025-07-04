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
      // User is now logged in!
      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('id', session.user.id)
        .single()
      
      if (!profile && !profileError) {
        // Get pending username from URL
        const pendingUsername = requestUrl.searchParams.get('username') || 
                               session.user.email?.split('@')[0] || 
                               'player'
        
        // MINIMAL INSERT - Only essential fields
        const { error: insertError } = await supabase.from('users').insert({
          id: session.user.id,
          email: session.user.email,
          username: pendingUsername
        })
        
        if (insertError) {
          console.error('Database insert error:', insertError)
          return NextResponse.redirect(new URL('/?error=database', requestUrl.origin))
        }
      }
      
      // Redirect to home with success flag
      return NextResponse.redirect(new URL('/?welcome=true', requestUrl.origin))
    }
  }
  
  // Something went wrong
  return NextResponse.redirect(new URL('/?error=auth', requestUrl.origin))
}
