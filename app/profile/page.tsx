// app/profile/page.tsx - COMPLETE OVERHAUL WITH ACTIVE SUPABASE INTEGRATION
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  User, Trophy, DollarSign, Target, TrendingUp, 
  Calendar, Coins, LogOut, Home, Edit2, Save,
  X, CheckCircle, XCircle, Percent, Zap, Users,
  Share2, Copy, Award, Clock, AlertTriangle,
  ExternalLink, Gift, Star, Download, RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Type definitions based on your actual database structure
type UserProfile = {
  id: string
  email: string
  username: string
  avatar_url?: string
  favorite_team?: string
  favorite_sport?: 'MLB' | 'NFL' | 'NCAAF'
  created_at: string
  updated_at: string
  total_earnings: number
  perfect_slates: number
  total_slates_submitted: number
  win_percentage: number
  token_balance: number
  lifetime_tokens_earned: number
  lifetime_tokens_used: number
  referral_code?: string
  bad_beats_8: number
  bad_beats_9: number
  referred_by?: string
  slates_toward_next_token: number
}

type ActiveSlate = {
  id: number
  user_id: string
  contest_id: number
  sport: 'MLB' | 'NFL' | 'NCAAF'
  week_number: number
  submitted_at: string
  tokens_used: number
  total_picks: number
  correct_picks: number | null
  is_finalized: boolean
  is_perfect: boolean | null
  live_correct_count: number
  graded_picks_count: number
}

type Submission = {
  id: number
  user_id: string
  contest_id: number
  submitted_at: string
  tokens_used: number
  correct_picks: number
  total_picks: number
  is_perfect: boolean
  payout_amount: number
  is_finalized: boolean
  contest?: {
    sport: string
    week_number: number
  }
}

type TokenTransaction = {
  id: number
  user_id: string
  transaction_type: string
  amount: number
  balance_after: number
  description: string
  created_at: string
  submission_id?: number
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState('')
  const [favoriteTeam, setFavoriteTeam] = useState('')
  const [favoriteSport, setFavoriteSport] = useState<'MLB' | 'NFL' | 'NCAAF'>('MLB')
  const [saving, setSaving] = useState(false)
  
  // Modal states
  const [showEarningsModal, setShowEarningsModal] = useState(false)
  const [showPerfectSlatesModal, setShowPerfectSlatesModal] = useState(false)
  const [showTotalSlatesModal, setShowTotalSlatesModal] = useState(false)
  const [showWinRateModal, setShowWinRateModal] = useState(false)
  const [showActiveSlatesModal, setShowActiveSlatesModal] = useState(false)
  const [showBadBeatsModal, setShowBadBeatsModal] = useState(false)
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [showReferralModal, setShowReferralModal] = useState(false)
  
  // Data states
  const [activeSlates, setActiveSlates] = useState<ActiveSlate[]>([])
  const [perfectSlates, setPerfectSlates] = useState<Submission[]>([])
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([])
  const [badBeats, setBadBeats] = useState<Submission[]>([])
  const [tokenTransactions, setTokenTransactions] = useState<TokenTransaction[]>([])
  const [winRateBySport, setWinRateBySport] = useState<{[key: string]: {total: number, perfect: number}}>({})
  const [copySuccess, setCopySuccess] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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
      await loadUserData(user.id)
    } catch (error) {
      console.error('Error:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadUserData = async (userId: string) => {
    // Load user profile
    const { data: profileData, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return
    }

    setProfile(profileData)
    setUsername(profileData.username || '')
    setFavoriteTeam(profileData.favorite_team || '')
    setFavoriteSport(profileData.favorite_sport || 'MLB')

    // Load active slates from view
    const { data: activeSlatesData } = await supabase
      .from('active_slates_view')
      .select('*')
      .eq('user_id', userId)
      .eq('is_finalized', false)

    if (activeSlatesData) {
      setActiveSlates(activeSlatesData)
    }

    // Load all submissions for history
    const { data: submissionsData } = await supabase
      .from('submissions')
      .select(`
        *,
        contest:contests(sport, week_number)
      `)
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })

    if (submissionsData) {
      setAllSubmissions(submissionsData)
      
      // Filter perfect slates
      const perfect = submissionsData.filter(s => s.is_perfect && s.is_finalized)
      setPerfectSlates(perfect)
      
      // Filter bad beats (8 or 9 correct)
      const beats = submissionsData.filter(s => 
        s.is_finalized && 
        (s.correct_picks === 8 || s.correct_picks === 9) && 
        !s.is_perfect
      )
      setBadBeats(beats)
      
      // Calculate win rate by sport
      const sportStats: {[key: string]: {total: number, perfect: number}} = {}
      submissionsData.forEach(s => {
        if (s.contest && s.is_finalized) {
          const sport = s.contest.sport
          if (!sportStats[sport]) {
            sportStats[sport] = { total: 0, perfect: 0 }
          }
          sportStats[sport].total++
          if (s.is_perfect) {
            sportStats[sport].perfect++
          }
        }
      })
      setWinRateBySport(sportStats)
    }

    // Load token transactions
    const { data: tokenData } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (tokenData) {
      setTokenTransactions(tokenData)
    }
  }

  const refreshData = async () => {
    if (!user || refreshing) return
    setRefreshing(true)
    await loadUserData(user.id)
    setRefreshing(false)
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
      await loadUserData(profile.id)
    }
    setSaving(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const copyPromoCode = async () => {
    if (profile?.referral_code) {
      await navigator.clipboard.writeText(profile.referral_code)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const shareOnTwitter = () => {
    if (profile?.referral_code) {
      const text = `Join me on Perfect Slate! Use my promo code ${profile.referral_code} to get a free token when you sign up. Let's win together! 🏆`
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
      window.open(url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-400 to-green-500 flex items-center justify-center">
        <div className="text-white pixel-font text-2xl animate-pulse">LOADING...</div>
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

  const tokensUntilNext = 30 - profile.slates_toward_next_token
  const tokenProgress = (profile.slates_toward_next_token / 30) * 100

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
      <div className="max-w-6xl mx-auto px-4 py-8">
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
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={refreshData}
                  disabled={refreshing}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-lg"
                >
                  <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                
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
          </div>

          {/* Main Stats Grid */}
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <ClickableStatCard
                icon={<DollarSign className="w-6 h-6 text-green-600" />}
                label="Total Earnings"
                value={`$${profile.total_earnings.toLocaleString()}`}
                color="green"
                onClick={() => setShowEarningsModal(true)}
              />
              <ClickableStatCard
                icon={<Trophy className="w-6 h-6 text-yellow-600" />}
                label="Perfect Slates"
                value={profile.perfect_slates.toString()}
                color="yellow"
                onClick={() => setShowPerfectSlatesModal(true)}
              />
              <ClickableStatCard
                icon={<Target className="w-6 h-6 text-blue-600" />}
                label="Total Slates"
                value={profile.total_slates_submitted.toString()}
                color="blue"
                onClick={() => setShowTotalSlatesModal(true)}
              />
              <ClickableStatCard
                icon={<Percent className="w-6 h-6 text-purple-600" />}
                label="Win Rate"
                value={`${winRate}%`}
                color="purple"
                onClick={() => setShowWinRateModal(true)}
              />
            </div>

            {/* New Sections Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <ClickableStatCard
                icon={<Calendar className="w-6 h-6 text-orange-600" />}
                label="Active Slates"
                value={activeSlates.length.toString()}
                color="orange"
                onClick={() => setShowActiveSlatesModal(true)}
                subtitle="Ungraded submissions"
              />
              
              <ClickableStatCard
                icon={<AlertTriangle className="w-6 h-6 text-red-600" />}
                label="Bad Beats"
                value={(profile.bad_beats_8 + profile.bad_beats_9).toString()}
                color="red"
                onClick={() => setShowBadBeatsModal(true)}
                subtitle="8 or 9 correct picks"
              />
            </div>

            {/* Tokens & Referral */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <ClickableStatCard
                icon={<Coins className="w-6 h-6 text-yellow-600" />}
                label="Token Balance"
                value={profile.token_balance.toString()}
                color="yellow"
                onClick={() => setShowTokenModal(true)}
                subtitle={`Earned: ${profile.lifetime_tokens_earned} • Used: ${profile.lifetime_tokens_used}`}
              />
              
              <ClickableStatCard
                icon={<Users className="w-6 h-6 text-green-600" />}
                label="Refer a Friend"
                value="1 TOKEN"
                color="green"
                onClick={() => setShowReferralModal(true)}
                subtitle="Share your promo code"
              />
            </div>

            {/* Badge System Placeholder */}
            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold pixel-font text-gray-800 flex items-center space-x-2">
                  <Award className="w-6 h-6 text-gray-600" />
                  <span>BADGES</span>
                </h3>
                <span className="text-xs pixel-font text-gray-500">COMING SOON</span>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
                    <Star className="w-6 h-6 text-gray-400" />
                  </div>
                ))}
              </div>
            </div>

            {/* Preferences */}
            {editing && (
              <div className="bg-gray-50 rounded-xl p-6 mt-8">
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
                      onChange={(e) => setFavoriteSport(e.target.value as 'MLB' | 'NFL' | 'NCAAF')}
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

      {/* Earnings Modal */}
      {showEarningsModal && (
        <Modal title="EARNINGS HISTORY" onClose={() => setShowEarningsModal(false)}>
          <div className="space-y-4">
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <h4 className="font-bold pixel-font text-green-800 mb-2">Total Lifetime Earnings</h4>
              <p className="text-2xl font-bold pixel-font text-green-600">${profile.total_earnings.toLocaleString()}</p>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {perfectSlates.filter(s => s.payout_amount > 0).map(slate => (
                <div key={slate.id} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <div className="font-bold pixel-font text-sm">
                      {slate.contest?.sport || 'Contest'} - Week {slate.contest?.week_number}
                    </div>
                    <div className="text-xs pixel-font text-gray-600">
                      {new Date(slate.submitted_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-green-600 font-bold pixel-font">+${slate.payout_amount}</div>
                </div>
              ))}
              
              {perfectSlates.filter(s => s.payout_amount > 0).length === 0 && (
                <div className="text-center py-8">
                  <DollarSign className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="pixel-font text-gray-600">No earnings yet - keep playing!</p>
                </div>
              )}
            </div>
            
            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg pixel-font flex items-center justify-center space-x-2">
              <Download className="w-4 h-4" />
              <span>REQUEST WITHDRAWAL</span>
            </button>
          </div>
        </Modal>
      )}

      {/* Perfect Slates Modal */}
      {showPerfectSlatesModal && (
        <Modal title="PERFECT SLATES" onClose={() => setShowPerfectSlatesModal(false)}>
          <div className="space-y-4">
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <h4 className="font-bold pixel-font text-yellow-800 mb-2">Perfect Slate Rewards</h4>
              <p className="text-sm pixel-font text-yellow-700">Each perfect slate = 5 tokens earned!</p>
            </div>
            
            {perfectSlates.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {perfectSlates.map(slate => (
                  <div key={slate.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-bold pixel-font text-sm">
                        {slate.contest?.sport || 'Contest'} - Week {slate.contest?.week_number}
                      </div>
                      <Trophy className="w-4 h-4 text-yellow-500" />
                    </div>
                    <div className="flex justify-between text-xs pixel-font text-gray-600">
                      <span>{new Date(slate.submitted_at).toLocaleDateString()}</span>
                      <span className="text-green-600">${slate.payout_amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
                <p className="pixel-font text-gray-600">No perfect slates yet - you got this!</p>
              </div>
            )}
            
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
              <p className="text-xs pixel-font text-blue-700 text-center">
                Total Tokens from Perfect Slates: {profile.perfect_slates * 5}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Total Slates Modal */}
      {showTotalSlatesModal && (
        <Modal title="TOTAL SLATES" onClose={() => setShowTotalSlatesModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <h4 className="font-bold pixel-font text-blue-800 mb-2">Token Milestones</h4>
              <div className="space-y-2 text-sm pixel-font text-blue-700">
                <p>• Every 30 slates = 1 token</p>
                <p>• Every 100 slates = 2 bonus tokens</p>
              </div>
            </div>
            
            <div className="text-center py-6">
              <Target className="w-16 h-16 mx-auto text-blue-500 mb-4" />
              <p className="pixel-font text-2xl font-bold text-gray-800 mb-2">
                {profile.total_slates_submitted}
              </p>
              <p className="pixel-font text-sm text-gray-600">Total Slates Submitted</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm pixel-font text-gray-700">Progress to Next Token</span>
                <span className="text-sm pixel-font font-bold">{profile.slates_toward_next_token}/30</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${tokenProgress}%` }}
                />
              </div>
              <p className="text-xs pixel-font text-gray-600 mt-2 text-center">
                {tokensUntilNext} more slates until next token!
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-lg font-bold pixel-font text-green-700">
                  {Math.floor(profile.total_slates_submitted / 30)}
                </div>
                <div className="text-xs pixel-font text-green-600">Tokens from Slates</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="text-lg font-bold pixel-font text-purple-700">
                  {Math.floor(profile.total_slates_submitted / 100) * 2}
                </div>
                <div className="text-xs pixel-font text-purple-600">Bonus Tokens (100s)</div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Win Rate Modal */}
      {showWinRateModal && (
        <Modal title="WIN RATE BREAKDOWN" onClose={() => setShowWinRateModal(false)}>
          <div className="space-y-4">
            <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
              <h4 className="font-bold pixel-font text-purple-800 mb-2">Overall Win Rate</h4>
              <p className="text-2xl font-bold pixel-font text-purple-600">{winRate}%</p>
              <p className="text-xs pixel-font text-purple-600 mt-1">
                {profile.perfect_slates} / {profile.total_slates_submitted} Perfect Slates
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-bold pixel-font text-gray-800">By Sport:</h4>
              <div className="space-y-2">
                {['MLB', 'NFL', 'NCAAF'].map(sport => {
                  const stats = winRateBySport[sport] || { total: 0, perfect: 0 }
                  const sportWinRate = stats.total > 0 
                    ? ((stats.perfect / stats.total) * 100).toFixed(1)
                    : '0.0'
                  
                  return (
                    <div key={sport} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="pixel-font text-sm font-bold">{sport}</span>
                        <div className="text-right">
                          <span className="pixel-font text-sm font-bold">{sportWinRate}%</span>
                          <span className="pixel-font text-xs text-gray-600 ml-2">
                            ({stats.perfect}/{stats.total})
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${sportWinRate}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Active Slates Modal */}
      {showActiveSlatesModal && (
        <Modal title="ACTIVE SLATES" onClose={() => setShowActiveSlatesModal(false)}>
          <div className="space-y-4">
            {activeSlates.length > 0 ? (
              activeSlates.map(slate => (
                <div key={slate.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold pixel-font text-sm">{slate.sport} Contest</div>
                      <div className="text-xs pixel-font text-gray-600">
                        Week {slate.week_number} • {new Date(slate.submitted_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs pixel-font ${
                      slate.graded_picks_count === 0 ? 'bg-yellow-100 text-yellow-800' :
                      slate.graded_picks_count < slate.total_picks ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {slate.graded_picks_count === 0 ? 'PENDING' :
                       slate.graded_picks_count < slate.total_picks ? 'LIVE' :
                       'GRADING'}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="text-xs pixel-font text-gray-600">
                      <span>Picks: {slate.total_picks - slate.tokens_used}</span>
                      {slate.tokens_used > 0 && (
                        <span className="ml-2">• Tokens: {slate.tokens_used}</span>
                      )}
                    </div>
                    
                    {slate.graded_picks_count > 0 && (
                      <div className="flex items-center space-x-2">
                        <div className="text-sm pixel-font font-bold">
                          {slate.live_correct_count}/{slate.graded_picks_count}
                        </div>
                        <div className="text-xs pixel-font text-gray-500">correct</div>
                      </div>
                    )}
                  </div>
                  
                  {slate.graded_picks_count > 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${(slate.graded_picks_count / slate.total_picks) * 100}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs pixel-font text-gray-600 mt-1 text-center">
                        {slate.graded_picks_count}/{slate.total_picks} graded
                      </p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="pixel-font text-gray-600">No active slates</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Bad Beats Modal */}
      {showBadBeatsModal && (
        <Modal title="BAD BEATS" onClose={() => setShowBadBeatsModal(false)}>
          <div className="space-y-4">
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <h4 className="font-bold pixel-font text-red-800 mb-2">Bad Beat Rewards</h4>
              <p className="text-sm pixel-font text-red-700">Each bad beat (8 or 9 correct) = 1 token!</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center bg-orange-50 rounded-lg p-4">
                <div className="text-3xl font-bold pixel-font text-orange-600">{profile.bad_beats_9}</div>
                <div className="text-sm pixel-font text-gray-600">9 Correct</div>
              </div>
              <div className="text-center bg-red-50 rounded-lg p-4">
                <div className="text-3xl font-bold pixel-font text-red-600">{profile.bad_beats_8}</div>
                <div className="text-sm pixel-font text-gray-600">8 Correct</div>
              </div>
            </div>
            
            {badBeats.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {badBeats.map(beat => (
                  <div key={beat.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold pixel-font text-sm">
                          {beat.contest?.sport || 'Contest'} - Week {beat.contest?.week_number}
                        </div>
                        <div className="text-xs pixel-font text-gray-600">
                          {new Date(beat.submitted_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs pixel-font font-bold ${
                        beat.correct_picks === 9 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {beat.correct_picks}/10
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                <p className="pixel-font text-gray-600">
                  No bad beats yet - that's a good thing!
                </p>
              </div>
            )}
            
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
              <p className="text-xs pixel-font text-blue-700 text-center">
                Total Bad Beat Tokens Earned: {profile.bad_beats_8 + profile.bad_beats_9}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Token Modal */}
      {showTokenModal && (
        <Modal title="TOKEN BALANCE" onClose={() => setShowTokenModal(false)}>
          <div className="space-y-4">
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 text-center">
              <Coins className="w-16 h-16 mx-auto text-yellow-600 mb-2" />
              <div className="text-3xl font-bold pixel-font text-yellow-700">{profile.token_balance}</div>
              <div className="text-sm pixel-font text-yellow-600">Available Tokens</div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-bold pixel-font text-gray-800">How to Earn Tokens:</h4>
              <div className="space-y-2 text-sm pixel-font text-gray-700">
                <p>🏆 Perfect slate = 5 tokens</p>
                <p>💔 Bad beat (8-9 correct) = 1 token</p>
                <p>📊 Every 30 slates = 1 token</p>
                <p>🎯 Every 100 slates = 2 bonus tokens</p>
                <p>👥 Refer a friend = 1 token</p>
              </div>
            </div>
            
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
              <p className="text-xs pixel-font text-blue-700">
                <strong>Token Stats:</strong> Earned {profile.lifetime_tokens_earned} • Used {profile.lifetime_tokens_used}
              </p>
            </div>
            
            {tokenTransactions.length > 0 && (
              <div>
                <h4 className="font-bold pixel-font text-gray-800 mb-2">Recent Transactions:</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tokenTransactions.slice(0, 10).map(tx => (
                    <div key={tx.id} className="bg-gray-50 rounded p-2 flex justify-between items-center">
                      <div className="text-xs pixel-font">
                        <div className="font-bold">{tx.description}</div>
                        <div className="text-gray-600">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className={`text-sm pixel-font font-bold ${
                        tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Referral Modal */}
      {showReferralModal && (
        <Modal title="REFER A FRIEND" onClose={() => setShowReferralModal(false)}>
          <div className="space-y-4">
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 text-center">
              <Gift className="w-16 h-16 mx-auto text-green-600 mb-2" />
              <h4 className="font-bold pixel-font text-green-800 mb-2">Earn 1 Token Per Referral!</h4>
              <p className="text-sm pixel-font text-green-700">Share your promo code with friends</p>
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm pixel-font text-gray-700 font-bold">YOUR PROMO CODE:</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={profile.referral_code || ''}
                  readOnly
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg pixel-font font-bold text-center bg-gray-50"
                />
                <button
                  onClick={copyPromoCode}
                  className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg pixel-font flex items-center space-x-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copySuccess ? 'COPIED!' : 'COPY'}</span>
                </button>
              </div>
            </div>
            
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <h4 className="font-bold pixel-font text-blue-800 mb-2">How it works:</h4>
              <div className="space-y-1 text-sm pixel-font text-blue-700">
                <p>1. Share your code with friends</p>
                <p>2. They enter it when signing up</p>
                <p>3. You both get 1 token!</p>
              </div>
            </div>
            
            <button 
              onClick={shareOnTwitter}
              className="w-full bg-blue-400 hover:bg-blue-500 text-white py-3 rounded-lg pixel-font flex items-center justify-center space-x-2"
            >
              <Share2 className="w-4 h-4" />
              <span>SHARE ON TWITTER</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Clickable Stat Card Component
function ClickableStatCard({ icon, label, value, color, onClick, subtitle }: any) {
  const bgColor = {
    green: 'bg-green-50 border-green-200 hover:border-green-300',
    yellow: 'bg-yellow-50 border-yellow-200 hover:border-yellow-300',
    blue: 'bg-blue-50 border-blue-200 hover:border-blue-300',
    purple: 'bg-purple-50 border-purple-200 hover:border-purple-300',
    orange: 'bg-orange-50 border-orange-200 hover:border-orange-300',
    red: 'bg-red-50 border-red-200 hover:border-red-300'
  }[color]

  return (
    <button
      onClick={onClick}
      className={`${bgColor} border-2 rounded-xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs pixel-font text-gray-600">{label}</span>
        <div className="opacity-60 group-hover:opacity-100 transition-opacity">
          {icon}
        </div>
      </div>
      <div className="text-xl font-bold pixel-font mb-1">
        {value}
      </div>
      {subtitle && (
        <div className="text-xs pixel-font text-gray-500">
          {subtitle}
        </div>
      )}
    </button>
  )
}

// Modal Component
function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
        <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-4 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold pixel-font text-gray-800">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
