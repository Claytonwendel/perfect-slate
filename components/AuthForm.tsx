// components/AuthForm.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Mail, Lock, User, Trophy, Zap, AlertCircle, 
  CheckCircle, Loader, ArrowRight, Star
} from 'lucide-react'

interface AuthFormProps {
  mode: 'signin' | 'signup'
  onModeChange: (mode: 'signin' | 'signup') => void
  onSuccess: () => void
}

export default function AuthForm({ mode, onModeChange, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Check if username is taken
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single()

      if (existingUser) {
        setError('Username already taken')
        setLoading(false)
        return
      }

      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: window.location.origin
        }
      })

      if (authError) throw authError

      if (authData.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: authData.user.email,
            username,
            created_at: new Date().toISOString()
          })

        if (profileError) throw profileError

        // Auto sign in after signup
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (!signInError) {
          onSuccess()
        } else {
          setSuccess('Account created! Please sign in.')
          onModeChange('signin')
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      // Successful sign in
      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
          SIGN UP
        </button>
        <button
          onClick={() => onModeChange('signin')}
          className={`flex-1 py-2 px-4 text-xs font-bold pixel-font rounded-md transition-all ${
            mode === 'signin'
              ? 'bg-blue-500 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          SIGN IN
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border-2 border-red-300 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-xs pixel-font text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border-2 border-green-300 rounded-lg flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="text-xs pixel-font text-green-700">{success}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}>
        {mode === 'signup' && (
          <div className="mb-4">
            <label className="block text-xs font-bold pixel-font text-gray-700 mb-2">
              USERNAME
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg pixel-font text-sm focus:border-green-500 focus:outline-none"
                placeholder="Choose username"
                required
                maxLength={20}
              />
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-bold pixel-font text-gray-700 mb-2">
            EMAIL
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
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold pixel-font text-gray-700 mb-2">
            PASSWORD
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg pixel-font text-sm focus:border-blue-500 focus:outline-none"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
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
              <span>{mode === 'signin' ? 'SIGN IN' : 'START PLAYING FREE'}</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      {/* Features for signup */}
      {mode === 'signup' && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <div className="bg-yellow-100 p-2 rounded">
                <Trophy className="w-4 h-4 text-yellow-600" />
              </div>
              <span className="text-xs pixel-font text-gray-600">
                Win Real $$$
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="bg-blue-100 p-2 rounded">
                <Zap className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs pixel-font text-gray-600">
                Free Tokens
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="bg-green-100 p-2 rounded">
                <Star className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-xs pixel-font text-gray-600">
                Daily Games
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="bg-purple-100 p-2 rounded">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-xs pixel-font text-gray-600">
                Leaderboards
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
