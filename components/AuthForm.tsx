'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Mail, Lock, User, Trophy, Zap, AlertCircle,
  CheckCircle, Loader, ArrowRight, Star, Users,
  Eye, EyeOff
} from 'lucide-react'

interface AuthFormProps {
  mode: 'signin' | 'signup'
  onModeChange: (mode: 'signin' | 'signup') => void
  onSuccess: () => void
}

export default function AuthForm({ mode, onModeChange, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle()

      if (existingUser) {
        setError('Username already taken')
        setLoading(false)
        return
      }

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
        await new Promise(resolve => setTimeout(resolve, 100))

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session) throw new Error('Session not established')

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

        if (!signInError) {
          onSuccess()
        } else {
          setSuccess('Account created! Please sign in.')
          onModeChange('signin')
        }
      }
    } catch (err: any) {
      console.error('Signup error:', err)
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
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

      {/* Error/Success */}
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
            <label className="block text-xs font-bold pixel-font text-gray-700 mb-2">USERNAME</label>
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
          <label className="block text-xs font-bold pixel-font text-gray-700 mb-2">EMAIL</label>
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

        <div className="mb-4">
          <label className="block text-xs font-bold pixel-font text-gray-700 mb-2">PASSWORD</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 border-2 border-gray-300 rounded-lg pixel-font text-sm focus:border-blue-500 focus:outline-none"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mode === 'signup' && (
          <div className="mb-6">
            <label className="block text-xs font-bold pixel-font text-gray-700 mb-2">CONFIRM PASSWORD</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full pl-10 pr-12 py-3 border-2 rounded-lg pixel-font text-sm focus:outline-none ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-gray-300 focus:border-green-500'
                }`}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1 pixel-font">Passwords do not match</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (mode === 'signup' && password !== confirmPassword)}
          className={`w-full py-4 rounded-lg pixel-font text-sm font-bold transition-all flex items-center justify-center space-x-2 shadow-md ${
            loading || (mode === 'signup' && confirmPassword && password !== confirmPassword)
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

      {/* Signup Features */}
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
                <div className={`p-2 rounded ${feature.label.includes('Win') ? 'bg-yellow-100' : feature.label.includes('Free') ? 'bg-blue-100' : feature.label.includes('Daily') ? 'bg-green-100' : 'bg-purple-100'}`}>
                  {feature.icon}
                </div>
                <span className="text-xs pixel-font text-gray-600">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
