// app/profile/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  User, Trophy, DollarSign, Target, TrendingUp, 
  Calendar, Coins, LogOut, Home, Edit2, Save,
  X, CheckCircle, XCircle, Percent, Zap
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type UserProfile = {
  id: string
  email: string
  username: string
  avatar_url?: string
  favorite_team?: string
  favorite_sport?: string
  created_at: string
  total_earnings: number
  perfect_slates: number
  total_slates_submitted: number
  win_percentage: number
  current_streak: number
  longest_streak: number
  token_balance: number
  lifetime_tokens_earned: number
  lifetime_tokens_used: number
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState('')
  const [favoriteTeam, setFavoriteTeam] = useState('')
  const [favoriteSport, setFavoriteSport] = useState('MLB')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      setUser(user)

      // Get user profile
      const { data: profileData, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        // If profile doesn't exist, create it
        if (error.code === 'PGRST116') {
          await createProfile(user)
        }
      } else {
        setProfile(profileData)
        setUsername(profileData.username || '')
        setFavoriteTeam(profileData.favorite_team || '')
        setFavoriteSport(profileData.favorite_sport || 'MLB')
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const createProfile = async (user: any) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        email: user.email,
        username: user.email.split('@')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_earnings: 0,
        earnings_total: 0,
        balance: 0,
        perfect_slates: 0,
        total_slates_submitted: 0,
        total_slates: 0,
        win_percentage: 0,
        win_rate: 0,
        bad_beats_9: 0,
        bad_beats_8: 0,
        current_streak: 0,
        longest_streak: 0,
        streak_days: 0,
        streak_current: 0,
        token_balance: 1,
        lifetime_tokens_earned: 1,
        lifetime_tokens_used: 0,
        slates_toward_next_token: 0,
        is_active: true,
        is_verified: true,
        verified: true,
        verification_status: 'verified',
        notification_preferences: {},
        favorite_sport: 'MLB'
      })
      .select()
      .single()

    if (!error && data) {
      setProfile(data)
      setUsername(data.username)
    }
  }

  const handleSave = async () => {
    if (!profile) return

    setSaving(true)
    const { error } = await supabase
      .from('user_profiles')
      .update({
        username,
        favorite_team: favoriteTeam,
        favorite_sport: favoriteSport,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id)

    if (!error) {
      setEditing(false)
      await checkUser() // Refresh data
    }
    setSaving(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-400 to-green-500 flex items-center justify-center">
        <div className="text-white pixel-font text-2xl">LOADING...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-400 to-green-500 flex items-center justify-center">
        <div className="text-white pixel-font text-2xl">PROFILE NOT FOUND</div>
      </div>
    )
  }

  const winRate = profile.total_slates_submitted > 0 
    ? ((profile.perfect_slates / profile.total_slates_submitted) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 to-green-500">
      {/* Navigation */}
      <nav className="relative z-20 bg-black bg-opacity-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => router.push('/')}
              className="flex items-center space-x-2 text-white pixel-font hover:text-yellow-300"
            >
              <Home className="w-5 h-5" />
              <span>BACK TO GAME</span>
            </button>
            
            <button 
              onClick={handleSignOut}
              className="flex items-center space-x-2 text-white pixel-font hover:text-red-300"
            >
              <LogOut className="w-5 h-5" />
              <span>SIGN OUT</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Profile Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                  <User className="w-10 h-10 text-blue-600" />
                </div>
                <div>
                  {editing ? (
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="text-2xl font-bold pixel-font bg-white bg-opacity-20 rounded px-3 py-1 text-white placeholder-white"
                      placeholder="Username"
                    />
                  ) : (
                    <h1 className="text-2xl md:text-3xl font-bold pixel-font text-white">
                      {profile.username}
                    </h1>
                  )}
                  <p className="text-white opacity-80 text-sm pixel-font">
                    Member since {new Date(profile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => editing ? handleSave() : setEditing(true)}
                disabled={saving}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg pixel-font flex items-center space-x-2"
              >
                {saving ? (
                  <div className="animate-spin">⚡</div>
                ) : editing ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>SAVE</span>
                  </>
                ) : (
                  <>
                    <Edit2 className="w-4 h-4" />
                    <span>EDIT</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={<DollarSign className="w-6 h-6 text-green-600" />}
                label="Total Earnings"
                value={`$${profile.total_earnings.toLocaleString()}`}
                color="green"
              />
              <StatCard
                icon={<Trophy className="w-6 h-6 text-yellow-600" />}
                label="Perfect Slates"
                value={profile.perfect_slates.toString()}
                color="yellow"
              />
              <StatCard
                icon={<Target className="w-6 h-6 text-blue-600" />}
                label="Total Slates"
                value={profile.total_slates_submitted.toString()}
                color="blue"
              />
              <StatCard
                icon={<Percent className="w-6 h-6 text-purple-600" />}
                label="Win Rate"
                value={`${winRate}%`}
                color="purple"
              />
            </div>

            {/* Streaks */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm pixel-font text-gray-600">CURRENT STREAK</span>
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-2xl font-bold pixel-font text-orange-600">
                  {profile.current_streak} DAYS
                </div>
              </div>
              
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm pixel-font text-gray-600">LONGEST STREAK</span>
                  <Trophy className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold pixel-font text-red-600">
                  {profile.longest_streak} DAYS
                </div>
              </div>
            </div>

            {/* Tokens */}
            <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-300 rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold pixel-font text-gray-800 mb-2">
                    TOKEN BALANCE
                  </h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Coins className="w-8 h-8 text-yellow-600" />
                      <span className="text-3xl font-bold pixel-font text-yellow-700">
                        {profile.token_balance}
                      </span>
                    </div>
                    <div className="text-sm pixel-font text-gray-600">
                      <div>Earned: {profile.lifetime_tokens_earned}</div>
                      <div>Used: {profile.lifetime_tokens_used}</div>
                    </div>
                  </div>
                </div>
                <Zap className="w-16 h-16 text-yellow-500 opacity-20" />
              </div>
            </div>

            {/* Preferences */}
            {editing && (
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-bold pixel-font text-gray-800 mb-4">
                  PREFERENCES
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm pixel-font text-gray-600 mb-2">
                      FAVORITE SPORT
                    </label>
                    <select
                      value={favoriteSport}
                      onChange={(e) => setFavoriteSport(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg pixel-font"
                    >
                      <option value="MLB">MLB</option>
                      <option value="NFL">NFL</option>
                      <option value="NCAAF">NCAAF</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm pixel-font text-gray-600 mb-2">
                      FAVORITE TEAM
                    </label>
                    <input
                      type="text"
                      value={favoriteTeam}
                      onChange={(e) => setFavoriteTeam(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg pixel-font"
                      placeholder="Enter team name"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({ icon, label, value, color }: any) {
  const bgColor = {
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200'
  }[color]

  return (
    <div className={`${bgColor} border-2 rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs pixel-font text-gray-600">{label}</span>
        {icon}
      </div>
      <div className="text-xl font-bold pixel-font">
        {value}
      </div>
    </div>
  )
}
