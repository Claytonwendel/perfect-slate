// components/AuthForm.tsx - FIXED VERSION
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Mail, Lock, User, Trophy, Zap, AlertCircle,
  CheckCircle, Loader, ArrowRight, Star, Users,
  Eye, EyeOff, Send
} from 'lucide-react'

interface AuthFormProps {
  mode: 'signin' | 'signup'
  onModeChange: (mode: 'signin' | 'signup') => void
  onSuccess: () => void
}

export default function AuthForm({ mode, onModeChange, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (mode === 'signup') {
        // Check if username is taken
        const { data: existingUser, error: usernameError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle()

        if (usernameError) {
          console.error('Username check error:', usernameError)
          setError('Database error: ' + usernameError.message)
          setLoading(false)
          return
        }

        if (existingUser) {
          setError('Username already taken')
          setLoading(false)
          return
        }
      }

      // Create redirect URL with username for signup - FIXED TO USE CALLBACK ROUTE
      let redirectUrl = `${window.location.origin}/auth/callback`
      if (mode === 'signup' && username) {
        redirectUrl += `?username=${encodeURIComponent(username)}`
      }

      console.log('🔗 Using redirect URL:', redirectUrl)

      // Send magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === 'signup',
          emailRedirectTo: redirectUrl
        }
      })

      if (error) throw error

      // Show success message
      setEmailSent(true)
      setSuccess(`Magic link sent to ${email}! Check your inbox (and spam folder).`)
      
    } catch (err: any) {
      console.error('Magic link error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="text-center py-8">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 animate-bounce">
            <Mail className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <h3 className="text-xl font-bold pixel-font text-gray-800 mb-3">
          CHECK YOUR EMAIL!
        </h3>
        
        <p className="text-sm pixel-font text-gray-600 mb-2">
          We sent a magic link to:
        </p>
        
        <p className="text-sm font-bold pixel-font text-blue-600 mb-6">
          {email}
        </p>
        
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
          <p className="text-xs pixel-font text-yellow-800">
            💡 Click the link in your email to sign in instantly!
          </p>
          <p className="text-xs pixel-font text-yellow-700 mt-2">
            No password needed - it's like magic! ✨
          </p>
        </div>
        
        <button
          onClick={() => {
            setEmailSent(false)
            setEmail('')
            setUsername('')
            setSuccess('')
          }}
          className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg pixel-font text-sm transition-colors"
        >
          SEND ANOTHER LINK
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Tab Switcher */}
      <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => onModeChange('signup')}
          className={`flex-1 py-2 px-4 text-xs font-bold pixel-font rounded-md transition-all ${
            mode === 'signup'
              ? 'bg-green-500 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          NEW PLAYER
        </button>
        <button
          onClick={() => onModeChange('signin')}
          className={`flex-1 py-2 px-4 text-xs font-bold pixel-font rounded-md transition-all ${
            mode === 'signin'
              ? 'bg-blue-500 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          RETURNING PLAYER
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border-2 border-red-300 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-xs pixel-font text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border-2 border-green-300 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-xs pixel-font text-green-700 font-bold">{success}</span>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSendMagicLink}>
        {mode === 'signup' && (
          <div className="mb-4">
            <label className="block text-xs font-bold pixel-font text-gray-700 mb-2">
              CHOOSE YOUR USERNAME
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg pixel-font text-sm focus:border-green-500 focus:outline-none"
                placeholder="coolplayer123"
                required
                maxLength={20}
                minLength={3}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 pixel-font">
              3-20 characters, letters & numbers only
            </p>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-xs font-bold pixel-font text-gray-700 mb-2">
            {mode === 'signup' ? 'YOUR EMAIL' : 'EMAIL'}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg pixel-font text-sm focus:border-blue-500 focus:outline-none"
              placeholder="your@email.com"
              required
            />
          </div>
          {mode === 'signin' && (
            <p className="text-xs text-gray-500 mt-1 pixel-font">
              We'll send you a magic link to sign in
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-lg pixel-font text-sm font-bold transition-all flex items-center justify-center space-x-2 shadow-md ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : mode === 'signin'
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {loading ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>{mode === 'signin' ? 'SEND MAGIC LINK' : 'GET STARTED'}</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs pixel-font text-gray-600 mb-2">
          🪄 No passwords needed!
        </p>
        <p className="text-xs pixel-font text-gray-500">
          Just click the link in your email to play
        </p>
      </div>

      {mode === 'signup' && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <Trophy className="w-4 h-4 text-yellow-600" />, label: 'Win Real $$$' },
              { icon: <Zap className="w-4 h-4 text-blue-600" />, label: 'Free Tokens' },
              { icon: <Star className="w-4 h-4 text-green-600" />, label: 'Daily Games' },
              { icon: <Users className="w-4 h-4 text-purple-600" />, label: 'Leaderboards' }
            ].map((feature, i) => (
              <div key={i} className="flex items-center space-x-2">
                <div className="bg-gray-100 p-2 rounded">{feature.icon}</div>
                <span className="text-xs pixel-font text-gray-600">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
