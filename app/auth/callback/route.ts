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
      console.log('🎯 AUTH SUCCESS - User logged in:', session.user.email)
      
      try {
        // Check if profile exists
        console.log('🔍 Checking if profile exists for user:', session.user.id)
        
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle()
        
        console.log('📋 Profile check result:', { profile, profileError })
        
        if (!profile) {
          const pendingUsername = requestUrl.searchParams.get('username') || 
                                 session.user.email?.split('@')[0] || 
                                 'player'
          
          console.log('👤 Creating new profile with username:', pendingUsername)
          
          // 🚨 HARDCORE DEBUGGING - Try the simplest possible insert
          console.log('💾 Attempting database insert...')
          console.log('Data to insert:', {
            id: session.user.id,
            email: session.user.email,
            username: pendingUsername
          })
          
          const { data: insertData, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              username: pendingUsername
            })
            .select() // Add select to see what was actually inserted
          
          console.log('📊 Insert result data:', insertData)
          console.log('❌ Insert error (if any):', insertError)
          
          if (insertError) {
            console.error('🚨 FULL ERROR DETAILS:')
            console.error('Message:', insertError.message)
            console.error('Code:', insertError.code)
            console.error('Details:', insertError.details)
            console.error('Hint:', insertError.hint)
            
            // Try username conflict fix
            if (insertError.message.includes('username') || insertError.code === '23505') {
              const uniqueUsername = `${pendingUsername}${Date.now()}`
              console.log('🔄 Retrying with unique username:', uniqueUsername)
              
              const { data: retryData, error: retryError } = await supabase
                .from('user_profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email,
                  username: uniqueUsername
                })
                .select()
              
              console.log('🔄 Retry result:', { retryData, retryError })
              
              if (retryError) {
                console.error('💀 RETRY ALSO FAILED:', retryError)
                return NextResponse.redirect(new URL(`/?error=retry_failed&msg=${encodeURIComponent(retryError.message)}`, requestUrl.origin))
              } else {
                console.log('✅ SUCCESS on retry!')
              }
            } else {
              // Return the actual error details in URL
              return NextResponse.redirect(new URL(`/?error=insert_failed&msg=${encodeURIComponent(insertError.message)}&code=${insertError.code}`, requestUrl.origin))
            }
          } else {
            console.log('✅ SUCCESS on first try!', insertData)
          }
        } else {
          console.log('👍 Profile already exists')
        }
        
        return NextResponse.redirect(new URL('/?success=true', requestUrl.origin))
        
      } catch (catchError: any) {
        console.error('💥 CAUGHT EXCEPTION:', catchError)
        return NextResponse.redirect(new URL(`/?error=exception&msg=${encodeURIComponent(catchError.message)}`, requestUrl.origin))
      }
    } else {
      console.error('🚫 AUTH FAILED:', error)
      return NextResponse.redirect(new URL(`/?error=auth_failed&msg=${encodeURIComponent(error?.message || 'Unknown auth error')}`, requestUrl.origin))
    }
  }
  
  console.error('🚫 NO CODE OR TOKEN PROVIDED')
  return NextResponse.redirect(new URL('/?error=no_auth_params', requestUrl.origin))
}
