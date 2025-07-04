// app/auth/callback/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token = requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')
  
  console.log('🚀 CALLBACK STARTED')
  console.log('URL:', request.url)
  console.log('Code:', code)
  console.log('Token:', token)
  console.log('Type:', type)
  
  if (code || token) {
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    console.log('📡 SUPABASE CLIENT CREATED')
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL!)
    console.log('Key starts with:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.substring(0, 20) + '...')
    
    let session = null
    let error = null
    
    if (code) {
      console.log('🔑 EXCHANGING CODE FOR SESSION')
      const result = await supabase.auth.exchangeCodeForSession(code)
      session = result.data.session
      error = result.error
      console.log('Session result:', !!session)
      console.log('Auth error:', error)
    } else if (token && type === 'magiclink') {
      console.log('🪄 VERIFYING MAGIC LINK')
      const result = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink',
      })
      session = result.data.session
      error = result.error
      console.log('Session result:', !!session)
      console.log('Auth error:', error)
    }
    
    if (!error && session) {
      console.log('✅ AUTH SUCCESS')
      console.log('User ID:', session.user.id)
      console.log('User Email:', session.user.email)
      
      try {
        // Test: Can we even SELECT from the table?
        console.log('🔍 TESTING TABLE ACCESS')
        const { data: testSelect, error: selectError } = await supabase
          .from('user_profiles')
          .select('count')
          .limit(1)
        
        console.log('Select test result:', testSelect)
        console.log('Select test error:', selectError)
        
        if (selectError) {
          console.error('❌ CANNOT EVEN SELECT FROM TABLE:', selectError)
          return NextResponse.redirect(new URL(`/?error=table_access&msg=${encodeURIComponent(selectError.message)}`, requestUrl.origin))
        }
        
        // Check if profile exists
        console.log('🔍 CHECKING IF PROFILE EXISTS')
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle()
        
        console.log('Profile check - data:', profile)
        console.log('Profile check - error:', profileError)
        
        if (!profile) {
          const pendingUsername = requestUrl.searchParams.get('username') || 
                                 session.user.email?.split('@')[0] || 
                                 'player'
          
          console.log('👤 CREATING PROFILE FOR:', pendingUsername)
          
          // Test: Minimal insert first
          console.log('💾 ATTEMPTING MINIMAL INSERT')
          const minimalData = {
            email: session.user.email,
            username: pendingUsername
          }
          console.log('Minimal data:', minimalData)
          
          const { data: minimalResult, error: minimalError } = await supabase
            .from('user_profiles')
            .insert(minimalData)
            .select()
          
          console.log('Minimal insert result:', minimalResult)
          console.log('Minimal insert error:', minimalError)
          
          if (minimalError) {
            console.error('💀 MINIMAL INSERT FAILED')
            console.error('Error code:', minimalError.code)
            console.error('Error message:', minimalError.message)
            console.error('Error details:', minimalError.details)
            console.error('Error hint:', minimalError.hint)
            
            return NextResponse.redirect(new URL(`/?error=minimal_insert&code=${minimalError.code}&msg=${encodeURIComponent(minimalError.message)}`, requestUrl.origin))
          }
          
          console.log('✅ MINIMAL INSERT SUCCESS!')
        } else {
          console.log('👍 PROFILE ALREADY EXISTS')
        }
        
        console.log('🎉 SUCCESS - REDIRECTING')
        return NextResponse.redirect(new URL('/?success=true', requestUrl.origin))
        
      } catch (catchError: any) {
        console.error('💥 CAUGHT EXCEPTION:', catchError)
        console.error('Exception name:', catchError.name)
        console.error('Exception message:', catchError.message)
        console.error('Exception stack:', catchError.stack)
        return NextResponse.redirect(new URL(`/?error=exception&msg=${encodeURIComponent(catchError.message)}`, requestUrl.origin))
      }
    } else {
      console.error('🚫 AUTH FAILED:', error)
      return NextResponse.redirect(new URL(`/?error=auth_failed&msg=${encodeURIComponent(error?.message || 'Unknown')}`, requestUrl.origin))
    }
  }
  
  console.error('🚫 NO AUTH PARAMS')
  return NextResponse.redirect(new URL('/?error=no_params', requestUrl.origin))
}
