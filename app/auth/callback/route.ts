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
        .from('user_profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle()
      
      // Only create profile if it doesn't exist
      if (!profile) {
        const pendingUsername = requestUrl.searchParams.get('username') || 
                               session.user.email?.split('@')[0] || 
                               'player'
        
        console.log('Creating new user profile for:', session.user.email)
        
        // Check if user already exists by email
        const { data: existingByEmail } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', session.user.email)
          .maybeSingle()
        
        if (existingByEmail) {
          console.log('User already exists with this email')
        } else {
          console.log('Attempting to insert new user...')
          
          // ✅ MINIMAL INSERT - Only required fields, let defaults handle the rest
          const { data: insertData, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              username: pendingUsername
              // ❌ REMOVED ALL OTHER FIELDS - let database defaults handle them
            })
          
          if (insertError) {
            console.error('Insert error:', insertError)
            
            if (insertError.message.includes('username') || insertError.code === '23505') {
              console.log('Username conflict, trying with unique username...')
              const uniqueUsername = `${pendingUsername}${Math.floor(Math.random() * 1000)}`
              
              const { error: retryError } = await supabase
                .from('user_profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email,
                  username: uniqueUsername
                })
              
              if (retryError) {
                console.error('Retry failed:', retryError)
                return NextResponse.redirect(new URL('/?error=database&details=' + encodeURIComponent(retryError.message), requestUrl.origin))
              } else {
                console.log('✅ User created with unique username!')
              }
            } else {
              return NextResponse.redirect(new URL('/?error=database&details=' + encodeURIComponent(insertError.message), requestUrl.origin))
            }
          } else {
            console.log('✅ User created successfully!')
          }
        }
      } else {
        console.log('User profile already exists')
      }
      
      // Redirect to home with success flag
      return NextResponse.redirect(new URL('/?verified=true', requestUrl.origin))
    }
  }
  
  // Something went wrong
  return NextResponse.redirect(new URL('/?error=auth', requestUrl.origin))
}
