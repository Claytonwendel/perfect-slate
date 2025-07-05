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
      // User is now logged in - the handle_email_confirmed trigger should have created their profile
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
