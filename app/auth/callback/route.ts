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
        .single()
      
      // Only create profile if it doesn't exist AND there was no error finding it
      if (!profile && profileError?.code === 'PGRST116') { // PGRST116 = not found
        const pendingUsername = requestUrl.searchParams.get('username') || 
                               session.user.email?.split('@')[0] || 
                               'player'
        
        console.log('Creating new user profile for:', session.user.email)
        
        // Check if user already exists by email
        const { data: existingByEmail, error: emailCheckError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', session.user.email)
          .maybeSingle() // Use maybeSingle instead of single
        
        if (existingByEmail) {
          console.log('User already exists with this email')
          // User exists, continue to redirect
        } else {
          console.log('Attempting to insert new user...')
          
          // ✅ FIXED: Insert with all required fields and proper defaults
          const { data: insertData, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              username: pendingUsername,
              token_balance: 1, // ✅ Give new users a token
              lifetime_tokens_earned: 1, // ✅ They earned their first token
              is_verified: true, // ✅ They verified their email via magic link
              favorite_sport: 'MLB', // ✅ Set default sport (handle enum properly)
              notification_preferences: { push: true, email: true } // ✅ Set default notifications
            })
          
          if (insertError) {
            console.error('Insert error:', insertError)
            
            if (insertError.message.includes('username') || insertError.code === '23505') {
              console.log('Username conflict detected, generating unique username...')
              const uniqueUsername = `${pendingUsername}${Math.floor(Math.random() * 1000)}`
              
              const { error: retryError } = await supabase
                .from('user_profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email,
                  username: uniqueUsername,
                  token_balance: 1,
                  lifetime_tokens_earned: 1,
                  is_verified: true,
                  favorite_sport: 'MLB',
                  notification_preferences: { push: true, email: true }
                })
              
              if (retryError) {
                console.error('Retry insert error:', retryError)
                return NextResponse.redirect(new URL('/?error=database&details=' + encodeURIComponent(retryError.message), requestUrl.origin))
              } else {
                console.log('✅ User created successfully with unique username!')
              }
            } else {
              return NextResponse.redirect(new URL('/?error=database&details=' + encodeURIComponent(insertError.message), requestUrl.origin))
            }
          } else {
            console.log('✅ User created successfully!')
          }
        }
      } else if (profile) {
        console.log('User profile already exists')
      } else if (profileError) {
        console.error('Error checking for existing profile:', profileError)
      }
      
      // Redirect to home with success flag
      return NextResponse.redirect(new URL('/?verified=true', requestUrl.origin))
    }
  }
  
  // Something went wrong
  return NextResponse.redirect(new URL('/?error=auth', requestUrl.origin))
}
