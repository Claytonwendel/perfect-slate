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
      
      if (!profile && !profileError) {
        const pendingUsername = requestUrl.searchParams.get('username') || 
                               session.user.email?.split('@')[0] || 
                               'player'
        
        // DETAILED DEBUGGING
        console.log('=== DEBUG INFO ===')
        console.log('Session User ID:', session.user.id)
        console.log('Session User ID Type:', typeof session.user.id)
        console.log('Session User Email:', session.user.email)
        console.log('Pending Username:', pendingUsername)
        console.log('Profile check result:', { profile, profileError })
        
        // Check if user already exists by email
        const { data: existingByEmail, error: emailCheckError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', session.user.email)
          .single()
        
        console.log('Email check result:', { existingByEmail, emailCheckError })
        
        if (existingByEmail) {
          console.log('User already exists with this email')
          // User exists, continue to redirect
        } else {
          console.log('Attempting to insert new user...')
          
          // Try to insert new user
          const { data: insertData, error: insertError } = await supabase.from('user_profiles').insert({
            id: session.user.id,
            email: session.user.email,
            username: pendingUsername
          })
          
          console.log('Insert result:', { insertData, insertError })
          
          if (insertError) {
            console.error('=== DETAILED INSERT ERROR ===')
            console.error('Error message:', insertError.message)
            console.error('Error code:', insertError.code)
            console.error('Error details:', insertError.details)
            console.error('Error hint:', insertError.hint)
            console.error('Full error object:', JSON.stringify(insertError, null, 2))
            
            if (insertError.message.includes('username')) {
              console.log('Username conflict detected, generating unique username...')
              const uniqueUsername = `${pendingUsername}${Math.floor(Math.random() * 1000)}`
              console.log('Retry with username:', uniqueUsername)
              
              const { error: retryError } = await supabase.from('user_profiles').insert({
                id: session.user.id,
                email: session.user.email,
                username: uniqueUsername
              })
              
              if (retryError) {
                console.error('Retry insert error:', retryError)
                return NextResponse.redirect(new URL('/?error=database&details=' + encodeURIComponent(retryError.message), requestUrl.origin))
              }
            } else {
              return NextResponse.redirect(new URL('/?error=database&details=' + encodeURIComponent(insertError.message), requestUrl.origin))
            }
          } else {
            console.log('✅ User created successfully!')
          }
        }
      }
      
      // Redirect to home with success flag
      return NextResponse.redirect(new URL('/?welcome=true', requestUrl.origin))
    }
  }
  
  // Something went wrong
  return NextResponse.redirect(new URL('/?error=auth', requestUrl.origin))
}
