'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Users, DollarSign, Trophy, Clock, X, Trash2,
  ChevronDown, AlertCircle, FileText, BarChart3, 
  User, Coins, Zap, Menu, CircleDollarSign, Calendar,
  Lock, Unlock, CheckCircle, XCircle, LogOut, ArrowRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'

// Type definitions
type Team = {
  id: number
  sport: 'NFL' | 'NCAAF' | 'MLB'
  full_name: string
  city: string
  nickname: string
  short_name: string
  abbreviation: string
  primary_color: string
  secondary_color: string
  logo_url: string
}

type Game = {
  id: number
  contest_id: number
  sport: 'NFL' | 'NCAAF' | 'MLB'
  home_team: string
  away_team: string
  home_team_short: string
  away_team_short: string
  scheduled_time: string
  home_spread: number
  away_spread: number
  total_points: number
  home_score?: number
  away_score?: number
  status: string
}

type Pick = {
  id: number
  game_id: number
  pick_type: 'spread' | 'total'
  selection: 'home' | 'away' | 'over' | 'under'
  line_value: number
  times_selected: number
}

type Contest = {
  id: number
  sport: 'NFL' | 'NCAAF' | 'MLB'
  season_id?: number
  week_number: number
  open_time: string
  lock_time: string
  close_time: string
  base_prize_pool: number
  rollover_amount: number
  sponsor_bonus: number
  final_prize_pool: number
  total_entries: number
  total_winners: number
  tokens_used_count: number
  perfect_slates_count: number
  status: string
  created_at?: string
  updated_at?: string
}

type UserPick = {
  gameId: number
  pickId: number
  pickType: 'spread' | 'total'
  selection: string
  displayText: string
}

// Custom Token Icon Component
const TokenIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold">T</text>
  </svg>
)

// Helper function to apply no-tie logic - Only ADD 0.5, never subtract
const applyNoTieLogic = (value: number): number => {
  return Math.floor(value) === value ? value + 0.5 : value
}

// Pixelated Cloud Component
const PixelatedCloud = ({ index }: { index: number }) => {
  const speeds = [25, 35, 45, 30, 40, 50, 28, 38]
  const sizes = [
    { width: 80, height: 40 },
    { width: 120, height: 50 },
    { width: 100, height: 45 },
    { width: 90, height: 35 },
    { width: 110, height: 48 },
    { width: 85, height: 38 },
    { width: 95, height: 42 },
    { width: 105, height: 46 }
  ]
  
  return (
    <div
      className="absolute bg-white/40"
      style={{
        top: `${15 + (index * 12) % 50}%`,
        width: `${sizes[index].width}px`,
        height: `${sizes[index].height}px`,
        animation: `cloudDrift ${speeds[index]}s linear infinite`,
        animationDelay: `${index * 3}s`,
        clipPath: `polygon(
          25% 0%, 75% 0%, 100% 25%, 100% 75%, 
          75% 100%, 25% 100%, 0% 75%, 0% 25%
        )`,
        imageRendering: 'pixelated'
      }}
    />
  )
}

export default function PerfectSlateGame() {
  const router = useRouter()
  
  // State
  const [selectedSport, setSelectedSport] = useState<'NFL' | 'NCAAF' | 'MLB'>('NFL')
  const [showSportDropdown, setShowSportDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [currentContest, setCurrentContest] = useState<Contest | null>(null)
  const [selectedPicks, setSelectedPicks] = useState<UserPick[]>([])
  const [gamesWithTokens, setGamesWithTokens] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showSlateModal, setShowSlateModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showPrizeHistory, setShowPrizeHistory] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState('')
  const [contestStatus, setContestStatus] = useState<'pre-contest' | 'active' | 'locked'>('active')
  const [user, setUser] = useState<any>(null)
  const [tokenBalance, setTokenBalance] = useState(0)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup')
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false)

  // Fetch initial data
  useEffect(() => {
    const handleAuthFlow = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const verified = urlParams.get('verified')
      const error = urlParams.get('error')
      const authType = urlParams.get('auth')
      
      if (authType === 'fragment') {
        const hash = window.location.hash
        if (hash.includes('access_token=')) {
          try {
            const { data, error } = await supabase.auth.getSession()
            
            if (data.session) {
              setUser(data.session.user)
              await loadUserProfile(data.session.user.id)
              setShowVerificationSuccess(true)
              window.history.replaceState({}, document.title, window.location.pathname + '?verified=true')
            }
          } catch (err) {
            console.error('Fragment processing error:', err)
          }
        }
        loadContestData()
        return
      }
      
      if (verified === 'true') {
        setShowVerificationSuccess(true)
        window.history.replaceState({}, document.title, window.location.pathname)
      }
      
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUser(session.user)
        await loadUserProfile(session.user.id)
      }
      
      loadContestData()
    }

    handleAuthFlow()
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user)
        await loadUserProfile(session.user.id)
        if (!showVerificationSuccess) {
          setShowVerificationSuccess(true)
        }
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setTokenBalance(0)
        setSelectedPicks([])
        setGamesWithTokens(new Set())
        setIsSubmitted(false)
      }
    })
    
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [selectedSport])

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      updateTimeRemaining()
    }, 1000)
    return () => clearInterval(timer)
  }, [currentContest, games])

  // Refresh scores for live games
  useEffect(() => {
    const scoreInterval = setInterval(() => {
      if (games.some(g => g.status === 'in_progress')) {
        loadContestData()
      }
    }, 30000)
    return () => clearInterval(scoreInterval)
  }, [games])

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: userData, error } = await supabase
        .from('user_profiles')
        .select('token_balance')
        .eq('id', userId)
        .single()
      
      if (error && error.code === 'PGRST116') {
        const { error: createError } = await supabase
          .rpc('create_profile_for_user', { user_id: userId })
        
        if (!createError) {
          const { data: newUserData } = await supabase
            .from('user_profiles')
            .select('token_balance')
            .eq('id', userId)
            .single()
          
          if (newUserData) {
            setTokenBalance(newUserData.token_balance)
          }
        }
      } else if (userData) {
        setTokenBalance(userData.token_balance)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      await loadUserProfile(user.id)
    }
  }

  const loadContestData = async () => {
    setIsLoading(true)
    
    const { data: contestData } = await supabase
      .from('contests')
      .select('*')
      .eq('sport', selectedSport)
      .in('status', ['open', 'locked', 'in_progress'])
      .order('week_number', { ascending: false })
      .limit(1)
      .single()
    
    if (contestData) {
      setCurrentContest(contestData)
      
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .eq('contest_id', contestData.id)
        .order('scheduled_time', { ascending: true })
      
      if (gamesData) {
        setGames(gamesData)
        
        const gameIds = gamesData.map(g => g.id)
        const { data: picksData } = await supabase
          .from('picks')
          .select('*')
          .in('game_id', gameIds)
        
        if (picksData) {
          setPicks(picksData)
        }
      }
      
      // Fetch teams data
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .eq('sport', selectedSport)
      
      if (teamsData) {
        const teamsMap = teamsData.reduce((acc, team) => {
          acc[team.full_name] = team
          return acc
        }, {} as Record<string, Team>)
        setTeams(teamsMap)
      }
    }
    
    setIsLoading(false)
  }

  const updateTimeRemaining = () => {
    if (!currentContest) return
    
    const now = new Date()
    const openTime = new Date(currentContest.open_time)
    
    if (now < openTime) {
      setContestStatus('pre-contest')
      const diff = openTime.getTime() - now.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTimeRemaining(`${hours}h ${minutes}m`)
      return
    }
    
    const upcomingGames = games.filter(g => 
      g.status === 'scheduled' && new Date(g.scheduled_time) > now
    )
    
    if (upcomingGames.length <= 4) {
      setContestStatus('locked')
      setTimeRemaining('LOCKED')
      return
    }
    
    if (upcomingGames.length >= 5) {
      setContestStatus('active')
      const fifthToLastGame = upcomingGames[upcomingGames.length - 5]
      const lockTime = new Date(fifthToLastGame.scheduled_time)
      const diff = lockTime.getTime() - now.getTime()
      
      if (diff <= 0) {
        setContestStatus('locked')
        setTimeRemaining('LOCKED')
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        setTimeRemaining(`${hours}h ${minutes}m`)
      }
    }
  }

  const isGameAvailable = (game: Game): boolean => {
    const now = new Date()
    const gameTime = new Date(game.scheduled_time)
    return game.status === 'scheduled' && gameTime > now
  }

  const handlePickSelect = (gameId: number, pickType: 'spread' | 'total', selection: string, displayText: string, pickId: number) => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    
    if (isSubmitted || gamesWithTokens.has(gameId) || contestStatus !== 'active') return
    
    const existingPickIndex = selectedPicks.findIndex(
      p => p.gameId === gameId && p.pickType === pickType && p.selection === selection
    )
    
    // Toggle logic: If exact same pick exists, remove it
    if (existingPickIndex !== -1) {
      const newPicks = [...selectedPicks]
      newPicks.splice(existingPickIndex, 1)
      setSelectedPicks(newPicks)
      return
    }
    
    // Check if different selection for same game/type exists
    const differentSelectionIndex = selectedPicks.findIndex(
      p => p.gameId === gameId && p.pickType === pickType
    )
    
    if (differentSelectionIndex !== -1) {
      const newPicks = [...selectedPicks]
      newPicks[differentSelectionIndex] = { gameId, pickId, pickType, selection, displayText }
      setSelectedPicks(newPicks)
    } else {
      const picksForThisGame = selectedPicks.filter(p => p.gameId === gameId)
      
      if (selectedPicks.length + gamesWithTokens.size >= 10) return
      if (picksForThisGame.length >= 2) return
      
      setSelectedPicks([...selectedPicks, { gameId, pickId, pickType, selection, displayText }])
    }
  }

  const handleTokenToggle = (gameId: number) => {
    if (isSubmitted || contestStatus !== 'active') return
    
    const newTokenGames = new Set(gamesWithTokens)
    
    if (newTokenGames.has(gameId)) {
      newTokenGames.delete(gameId)
      setGamesWithTokens(newTokenGames)
    } else {
      if (selectedPicks.length + newTokenGames.size >= 10) return
      if (gamesWithTokens.size >= 5) return
      
      setSelectedPicks(selectedPicks.filter(p => p.gameId !== gameId))
      newTokenGames.add(gameId)
      setGamesWithTokens(newTokenGames)
    }
  }

  const removePick = (index: number) => {
    setSelectedPicks(selectedPicks.filter((_, i) => i !== index))
  }

  const submitSlate = async () => {
    if (!user || !currentContest) return
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-picks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            contestId: currentContest.id,
            picks: selectedPicks.map(p => p.pickId),
            tokensUsed: gamesWithTokens.size
          })
        }
      )
      
      const result = await response.json()
      
      if (result.success) {
        setIsSubmitted(true)
        setShowConfirmModal(false)
        setShowSlateModal(false)
        setShowSuccessModal(true)
        checkUser()
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error submitting picks:', error)
      alert('Failed to submit picks. Please try again.')
    }
  }

  const GameCard = ({ game }: { game: Game }) => {
    const gamePicks = picks.filter(p => p.game_id === game.id)
    const spreads = gamePicks.filter(p => p.pick_type === 'spread')
    const totals = gamePicks.filter(p => p.pick_type === 'total')
    
    const homeSpread = spreads.find(p => p.selection === 'home')
    const awaySpread = spreads.find(p => p.selection === 'away')
    const overTotal = totals.find(p => p.selection === 'over')
    const underTotal = totals.find(p => p.selection === 'under')
    
    const hasToken = gamesWithTokens.has(game.id)
    const isAvailable = isGameAvailable(game)
    const isGameDisabled = hasToken || isSubmitted || !isAvailable || contestStatus !== 'active'
    const isGameStarted = game.status === 'in_progress' || game.status === 'final'
    
    // Get team data
    const homeTeam? = teams[game.home_team] || {}
    const awayTeam? = teams[game.away_team] || {}
    
    // Check if on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
    
    // Calculate pick percentages
    const totalSpreadPicks = (homeSpread?.times_selected || 0) + (awaySpread?.times_selected || 0)
    const totalTotalPicks = (overTotal?.times_selected || 0) + (underTotal?.times_selected || 0)
    
    const homeSpreadPct = totalSpreadPicks > 0 ? Math.round((homeSpread?.times_selected || 0) / totalSpreadPicks * 100) : 50
    const awaySpreadPct = totalSpreadPicks > 0 ? Math.round((awaySpread?.times_selected || 0) / totalSpreadPicks * 100) : 50
    const overPct = totalTotalPicks > 0 ? Math.round((overTotal?.times_selected || 0) / totalTotalPicks * 100) : 50
    const underPct = totalTotalPicks > 0 ? Math.round((underTotal?.times_selected || 0) / totalTotalPicks * 100) : 50
    
    // Apply no-tie logic
    const homeSpreadDisplay = applyNoTieLogic(game.home_spread)
    const awaySpreadDisplay = applyNoTieLogic(game.away_spread)
    const totalDisplay = applyNoTieLogic(game.total_points)
    
    // Find most popular picks for closed games
    const mostPopularSpread = homeSpreadPct >= awaySpreadPct ? 
      { text: `${homeTeam?.short_name || game.home_team_short} ${homeSpreadDisplay > 0 ? '+' : ''}${homeSpreadDisplay}`, pct: homeSpreadPct } :
      { text: `${awayTeam?.short_name || game.away_team_short} ${awaySpreadDisplay > 0 ? '+' : ''}${awaySpreadDisplay}`, pct: awaySpreadPct }
    
    const mostPopularTotal = overPct >= underPct ?
      { text: `Over ${totalDisplay}`, pct: overPct } :
      { text: `Under ${totalDisplay}`, pct: underPct }
    
    return (
      <div 
        className={`relative rounded-xl overflow-hidden shadow-lg border-4 ${
          hasToken ? 'border-yellow-400' : 
          !isAvailable ? 'border-gray-400' : 
          'border-gray-300'
        } hover:shadow-xl transition-all duration-300`}
      >
        {/* Gradient Background using team colors */}
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${awayTeam?.primary_color || '#666'} 0%, ${awayTeam?.primary_color || '#666'} 45%, ${homeTeam?.primary_color || '#999'} 55%, ${homeTeam?.primary_color || '#999'} 100%)`,
            opacity: 0.1
          }}
        />
        
        {/* Content Container */}
        <div className="relative bg-white/98 backdrop-blur p-3 md:p-4">
          
          {/* Header Row */}
          <div className="flex justify-between items-start mb-3">
            {/* Time & Status */}
            <div className="flex flex-col">
              <div className="flex items-center space-x-1 text-gray-700">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] md:text-xs pixel-font font-bold">
                  {new Date(game.scheduled_time).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    timeZone: 'America/New_York'
                  })} ET
                </span>
              </div>
              <div className="flex items-center space-x-1 mt-1">
                {isAvailable && contestStatus === 'active' ? (
                  <>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] pixel-font text-green-600 font-bold">OPEN</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                    <span className="text-[9px] pixel-font text-red-600 font-bold">CLOSED</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Token Button */}
            {isAvailable && contestStatus === 'active' && (
              <button
                onClick={() => handleTokenToggle(game.id)}
                className={`flex items-center space-x-1 px-2 py-1 rounded-full text-[10px] md:text-xs pixel-font transition-all ${
                  hasToken 
                    ? 'bg-yellow-400 text-yellow-900 shadow-md' 
                    : 'bg-gray-100 hover:bg-yellow-100 text-gray-700'
                }`}
              >
                <TokenIcon className="w-3 h-3" />
                <span>{hasToken ? 'USED' : 'TOKEN'}</span>
              </button>
            )}
          </div>
          
          {/* Teams Display */}
          <div className="flex items-center justify-center mb-3">
            {/* Away Team */}
            <div className="flex items-center space-x-1 md:space-x-2 flex-1 justify-end">
              {awayTeam?.logo_url && (
                <img 
                  src={awayTeam?.logo_url} 
                  alt={awayTeam?.short_name}
                  className="w-6 h-6 md:w-8 md:h-8"
                  style={{ imageRendering: 'pixelated' }}
                />
              )}
              <span className="text-xs md:text-sm font-bold pixel-font" style={{ color: awayTeam?.primary_color || '#000' }}>
                {isMobile ? (awayTeam?.abbreviation || game.away_team_short) : awayTeam?.city}
              </span>
            </div>
            
            {/* @ Symbol */}
            <span className="mx-2 md:mx-3 text-gray-500 text-xs md:text-sm pixel-font">@</span>
            
            {/* Home Team */}
            <div className="flex items-center space-x-1 md:space-x-2 flex-1">
              <span className="text-xs md:text-sm font-bold pixel-font" style={{ color: homeTeam?.primary_color || '#000' }}>
                {isMobile ? (homeTeam?.abbreviation || game.home_team_short) : homeTeam?.city}
              </span>
              {homeTeam?.logo_url && (
                <img 
                  src={homeTeam?.logo_url} 
                  alt={homeTeam?.short_name}
                  className="w-6 h-6 md:w-8 md:h-8"
                  style={{ imageRendering: 'pixelated' }}
                />
              )}
            </div>
          </div>
          
          {/* Live Score Display */}
          {isGameStarted && (
            <div className="text-center mb-3">
              <div className="text-lg font-bold pixel-font">
                <span className={game.away_score! > game.home_score! ? 'text-green-600' : 'text-gray-700'}>
                  {game.away_score || 0}
                </span>
                <span className="text-gray-500 mx-2">-</span>
                <span className={game.home_score! > game.away_score! ? 'text-green-600' : 'text-gray-700'}>
                  {game.home_score || 0}
                </span>
              </div>
              {game.status === 'in_progress' && (
                <span className="text-[10px] pixel-font text-red-600 animate-pulse">LIVE</span>
              )}
              {game.status === 'final' && (
                <span className="text-[10px] pixel-font text-gray-600">FINAL</span>
              )}
            </div>
          )}
          
          {/* Picks Grid */}
          {!isGameStarted && isAvailable ? (
            <div className="space-y-2 md:space-y-3">
              {/* Spread */}
              <div>
                <div className="text-center text-[10px] font-bold text-gray-500 mb-1 pixel-font">SPREAD</div>
                <div className="grid grid-cols-2 gap-2">
                  <PickButton
                    text={`${awayTeam?.abbreviation || game.away_team_short} ${awaySpreadDisplay > 0 ? '+' : ''}${awaySpreadDisplay}`}
                    isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'spread' && p.selection === 'away')}
                    onClick={() => handlePickSelect(game.id, 'spread', 'away', 
                      `${awayTeam?.abbreviation || game.away_team_short} ${awaySpreadDisplay > 0 ? '+' : ''}${awaySpreadDisplay}`, 
                      awaySpread!.id
                    )}
                    disabled={isGameDisabled}
                    percentage={awaySpreadPct}
                  />
                  <PickButton
                    text={`${homeTeam?.abbreviation || game.home_team_short} ${homeSpreadDisplay > 0 ? '+' : ''}${homeSpreadDisplay}`}
                    isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'spread' && p.selection === 'home')}
                    onClick={() => handlePickSelect(game.id, 'spread', 'home',
                      `${homeTeam?.abbreviation || game.home_team_short} ${homeSpreadDisplay > 0 ? '+' : ''}${homeSpreadDisplay}`,
                      homeSpread!.id
                    )}
                    disabled={isGameDisabled}
                    percentage={homeSpreadPct}
                  />
                </div>
              </div>
              
              {/* Total */}
              <div>
                <div className="text-center text-[10px] font-bold text-gray-500 mb-1 pixel-font">
                  {game.sport === 'MLB' ? 'TOTAL RUNS' : 'TOTAL POINTS'}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PickButton
                    text={`Over ${totalDisplay}`}
                    isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'total' && p.selection === 'over')}
                    onClick={() => handlePickSelect(game.id, 'total', 'over',
                      `Over ${totalDisplay}`,
                      overTotal!.id
                    )}
                    disabled={isGameDisabled}
                    percentage={overPct}
                  />
                  <PickButton
                    text={`Under ${totalDisplay}`}
                    isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'total' && p.selection === 'under')}
                    onClick={() => handlePickSelect(game.id, 'total', 'under',
                      `Under ${totalDisplay}`,
                      underTotal!.id
                    )}
                    disabled={isGameDisabled}
                    percentage={underPct}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Show popular picks for closed games */
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-xs font-bold pixel-font text-gray-700 mb-2">MOST POPULAR</div>
                <div className="space-y-2">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-2">
                    <div className="text-xs font-bold pixel-font text-blue-800">
                      {mostPopularSpread.text} ({mostPopularSpread.pct}%)
                    </div>
                    <div className="text-[10px] pixel-font text-blue-600">SPREAD</div>
                  </div>
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-2">
                    <div className="text-xs font-bold pixel-font text-purple-800">
                      {mostPopularTotal.text} ({mostPopularTotal.pct}%)
                    </div>
                    <div className="text-[10px] pixel-font text-purple-600">TOTAL</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Token Indicator */}
          {hasToken && (
            <div className="mt-3 text-center">
              <span className="text-[10px] text-yellow-700 pixel-font animate-pulse">
                TOKEN APPLIED - NO PICKS NEEDED
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const PickButton = ({ text, isSelected, onClick, disabled, percentage }: any) => {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          relative px-2 md:px-3 py-1.5 md:py-2 rounded-lg pixel-font text-[10px] md:text-xs font-bold transition-all duration-200 overflow-hidden
          ${isSelected 
            ? 'bg-yellow-400 border-2 border-yellow-600 text-yellow-900 shadow-lg' 
            : disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gray-100 hover:bg-blue-100 text-gray-700 hover:shadow-md cursor-pointer'
          }
        `}
      >
        {/* Percentage Background */}
        {percentage !== undefined && (
          <div 
            className="absolute left-0 top-0 bottom-0 bg-black opacity-5"
            style={{ width: `${percentage}%` }}
          />
        )}
        
        {/* Content */}
        <span className="relative z-10 flex items-center justify-center space-x-1">
          {isSelected && <Zap className="w-2.5 h-2.5 md:w-3 md:h-3" />}
          <span className="truncate">{text}</span>
          {percentage !== undefined && (
            <span className="text-[9px] opacity-75 ml-1">({percentage}%)</span>
          )}
        </span>
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sky-400 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4">
            <CircleDollarSign className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white pixel-font">LOADING...</h2>
        </div>
      </div>
    )
  }

  const totalPicks = selectedPicks.length + gamesWithTokens.size
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  return (
    <div className="min-h-screen relative">
      <style jsx>{`
        @keyframes cloudDrift {
          from { transform: translateX(-200px); }
          to { transform: translateX(calc(100vw + 200px)); }
        }
      `}</style>
      
      {/* Sky Blue Top Section */}
      <div className="bg-sky-400 absolute top-0 left-0 right-0 h-[450px]"></div>
      
      {/* Pixelated Clouds */}
      <div className="absolute top-0 left-0 right-0 h-[450px] overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <PixelatedCloud key={i} index={i} />
        ))}
      </div>
      
      {/* Green Field Bottom Section */}
      <div className="bg-green-500 absolute top-[450px] left-0 right-0 bottom-0"></div>
      
      {/* Navigation */}
      <nav className="relative z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            {/* Sport Selector */}
            <div className="relative">
              <button
                onClick={() => setShowSportDropdown(!showSportDropdown)}
                className="flex items-center space-x-1 text-white pixel-font text-xs md:text-sm hover:text-yellow-300 transition-colors"
              >
                <span>PERFECT SLATE {selectedSport}</span>
                <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
              </button>
              
              {showSportDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl overflow-hidden z-50">
                  {['MLB', 'NFL', 'NCAAF'].map(sport => (
                    <button
                      key={sport}
                      onClick={() => {
                        setSelectedSport(sport as any)
                        setShowSportDropdown(false)
                      }}
                      className="block w-full text-left px-4 py-2 pixel-font text-[10px] md:text-xs hover:bg-blue-50 transition-colors"
                    >
                      {sport}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center space-x-4">
              <button className="text-white pixel-font text-xs hover:text-yellow-300 transition-colors flex items-center space-x-1">
                <FileText className="w-3 h-3" />
                <span>RULES</span>
              </button>
              <button className="text-white pixel-font text-xs hover:text-yellow-300 transition-colors flex items-center space-x-1">
                <BarChart3 className="w-3 h-3" />
                <span>LEADERBOARDS</span>
              </button>
              {user ? (
                <button 
                  onClick={() => router.push('/profile')}
                  className="text-white pixel-font text-xs hover:text-yellow-300 transition-colors flex items-center space-x-1"
                >
                  <User className="w-3 h-3" />
                  <span>PROFILE</span>
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setAuthMode('signup')
                    setShowAuthModal(true)
                  }}
                  className="bg-yellow-400 text-yellow-900 pixel-font text-xs hover:bg-yellow-300 transition-colors flex items-center space-x-1 px-3 py-1.5 rounded-lg font-bold"
                >
                  <Zap className="w-3 h-3" />
                  <span>SIGN UP</span>
                </button>
              )}
            </div>
            
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          
          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden mt-3 pb-3 border-t border-blue-300 pt-3">
              <button className="block w-full text-left text-white pixel-font text-xs py-1.5 hover:text-yellow-300 transition-colors">
                RULES
              </button>
              <button className="block w-full text-left text-white pixel-font text-xs py-1.5 hover:text-yellow-300 transition-colors">
                LEADERBOARDS
              </button>
              {user ? (
                <button 
                  onClick={() => {
                    router.push('/profile')
                    setShowMobileMenu(false)
                  }}
                  className="block w-full text-left text-white pixel-font text-xs py-1.5 hover:text-yellow-300 transition-colors"
                >
                  PROFILE
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setAuthMode('signup')
                    setShowAuthModal(true)
                    setShowMobileMenu(false)
                  }}
                  className="block w-full text-left text-yellow-300 pixel-font text-xs py-1.5 hover:text-yellow-400 transition-colors font-bold"
                >
                  SIGN UP TO PLAY
                </button>
              )}
            </div>
          )}
        </div>
      </nav>
      
      {/* Header Content */}
      <div className="relative z-10 pb-12">
        <div className="text-center pt-6">
          {/* Prize Pool */}
          <button
            onClick={() => setShowPrizeHistory(true)}
            className="inline-block mb-4 group"
          >
            <div className="bg-yellow-400 rounded-xl px-4 md:px-6 py-2 md:py-3 shadow-xl transform group-hover:scale-105 transition-all duration-300">
              <div className="flex items-center space-x-2">
                <Coins className="w-5 h-5 md:w-6 md:h-6 text-yellow-700" />
                <span className="text-lg md:text-xl font-bold pixel-font text-yellow-900">
                  ${currentContest?.final_prize_pool.toLocaleString() || '0'}
                </span>
                <AlertCircle className="w-3 h-3 md:w-4 md:h-4 text-yellow-700" />
              </div>
            </div>
          </button>
          
          {/* Stats */}
          <div className="flex justify-center items-center space-x-4 md:space-x-6 text-white mb-6">
            <div>
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Users className="w-3 h-3 md:w-4 md:h-4" />
                <span className="text-base md:text-lg font-bold pixel-font">
                  {currentContest?.total_entries || 0}
                </span>
              </div>
              <div className="text-[10px] pixel-font opacity-90">ENTRIES</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Clock className="w-3 h-3 md:w-4 md:h-4" />
                <span className="text-base md:text-lg font-bold pixel-font">
                  {timeRemaining}
                </span>
              </div>
              <div className="text-[10px] pixel-font opacity-90">
                {contestStatus === 'pre-contest' ? 'OPENS IN' : 
                 contestStatus === 'active' ? 'CLOSES IN' : 
                 'CONTEST LOCKED'}
              </div>
            </div>
          </div>
          
          {/* Today's Challenge */}
          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-white/90 backdrop-blur rounded-xl p-3 md:p-4 shadow-xl border-3 border-yellow-400">
              <h2 className="text-base md:text-lg font-bold pixel-font text-gray-800 mb-1">
                SELECT YOUR PERFECT 10
              </h2>
              <div className="flex items-center justify-center space-x-1 text-gray-600">
                <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                <span className="text-xs md:text-sm pixel-font">{today}</span>
              </div>
              {contestStatus === 'pre-contest' && (
                <div className="mt-2 text-xs pixel-font text-orange-600">
                  Contest opens at 7:00 AM ET
                </div>
              )}
              {contestStatus === 'locked' && (
                <div className="mt-2 text-xs pixel-font text-red-600">
                  Contest is locked - games in progress
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Games Grid */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pb-24 -mt-8">
        <div className="space-y-3">
          {games.map(game => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
      
      {/* Floating Pick Counter */}
      {(totalPicks > 0) && !isSubmitted && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => setShowSlateModal(true)}
            className={`${totalPicks === 10 ? 'bg-green-400' : totalPicks > 0 ? 'bg-yellow-400' : 'bg-white'} rounded-full shadow-xl p-3 md:p-4 hover:scale-110 transition-all duration-300 ${totalPicks === 10 ? 'animate-pulse' : ''}`}
          >
            <div className="text-center">
              <div className="text-lg md:text-xl font-bold pixel-font text-gray-800">
                {totalPicks}
              </div>
              <div className="text-[10px] pixel-font text-gray-600">PICKS</div>
            </div>
            {totalPicks === 10 && (
              <div className="absolute -top-1 -right-1 animate-bounce">
                <div className="bg-green-400 rounded-full p-1">
                  <Trophy className="w-3 h-3 text-white" />
                </div>
              </div>
            )}
          </button>
          
          {totalPicks === 10 && (
            <div className="absolute -top-12 right-0 bg-green-500 rounded-lg px-3 py-1 shadow-lg animate-pulse">
              <span className="text-[10px] pixel-font text-white font-bold">READY!</span>
            </div>
          )}
        </div>
      )}
      
      {/* Slate Modal */}
      {showSlateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 md:p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base md:text-lg font-bold pixel-font">
                YOUR SLATE ({totalPicks}/10)
              </h3>
              <button onClick={() => setShowSlateModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Token Balance */}
            {user && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold pixel-font">TOKEN BALANCE:</span>
                  <span className="text-base font-bold pixel-font text-yellow-700">{tokenBalance}</span>
                </div>
                <div className="text-[10px] pixel-font mt-1 text-gray-600">
                  Using {gamesWithTokens.size} token{gamesWithTokens.size !== 1 ? 's' : ''} this slate
                </div>
              </div>
            )}
            
            {/* Picks List */}
            <div className="space-y-2 mb-4">
              {selectedPicks.map((pick, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-xs font-bold pixel-font">{pick.displayText}</span>
                  <button onClick={() => removePick(index)}>
                    <Trash2 className="w-3 h-3 text-red-500 hover:text-red-700" />
                  </button>
                </div>
              ))}
              
              {/* Token Games */}
              {Array.from(gamesWithTokens).map((gameId) => {
                const game = games.find(g => g.id === gameId)
                if (!game) return null
                const homeTeam? = teams[game.home_team] || {}
                const awayTeam? = teams[game.away_team] || {}
                return (
                  <div key={`token-${gameId}`} className="bg-yellow-50 rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center space-x-1">
                      <TokenIcon className="w-3 h-3 text-yellow-600" />
                      <span className="text-xs font-bold pixel-font">
                        TOKEN: {awayTeam?.abbreviation || game.away_team_short} @ {homeTeam?.abbreviation || game.home_team_short}
                      </span>
                    </div>
                    <button onClick={() => handleTokenToggle(gameId)}>
                      <Trash2 className="w-3 h-3 text-red-500 hover:text-red-700" />
                    </button>
                  </div>
                )
              })}
            </div>
            
            {/* Actions */}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <button
                onClick={() => setShowSlateModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 px-3 rounded-lg font-bold text-xs pixel-font transition-colors"
              >
                KEEP BUILDING
              </button>
              {totalPicks === 10 && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 bg-green-500 hover:bg-green-600 py-2 px-3 rounded-lg font-bold text-xs pixel-font text-white transition-colors"
                >
                  SUBMIT SLATE
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 md:p-6 max-w-sm w-full">
            <div className="text-center">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
              <h3 className="text-base font-bold pixel-font mb-3">LOCK IT IN?</h3>
              <p className="text-xs pixel-font text-gray-700 mb-4">
                This slate is FINAL! No changes allowed!
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 px-3 rounded-lg font-bold text-xs pixel-font transition-colors"
                >
                  WAIT
                </button>
                <button
                  onClick={submitSlate}
                  className="flex-1 bg-green-500 hover:bg-green-600 py-2 px-3 rounded-lg font-bold text-xs pixel-font text-white transition-colors"
                >
                  SUBMIT!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 md:p-6">
            <div className="text-center">
              <div className="mb-3 animate-bounce">
                <Trophy className="w-12 h-12 mx-auto text-yellow-500" />
              </div>
              <h3 className="text-lg font-bold pixel-font mb-2">SLATE LOCKED!</h3>
              <p className="text-xs pixel-font text-gray-700 mb-3">
                Good luck! Check back after games end.
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-white font-bold pixel-font text-xs transition-colors"
              >
                LET'S GO!
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl border-3 border-gray-800 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 z-10"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="relative bg-gradient-to-b from-green-500 to-green-600 p-5 text-center">
              <div className="flex justify-center mb-2">
                <Zap className="w-8 h-8 text-yellow-300" />
              </div>
              <h2 className="text-base font-bold text-white pixel-font mb-2">
                SIGN UP TO PLAY
              </h2>
              <p className="text-yellow-300 text-[10px] pixel-font mb-1">
                Win real cash prizes daily
              </p>
              <p className="text-white text-[10px] pixel-font opacity-90">
                100% FREE to play
              </p>
            </div>
            
            <div className="p-4">
              <AuthForm 
                mode={authMode} 
                onModeChange={setAuthMode}
                onSuccess={() => {
                  setShowAuthModal(false)
                  checkUser()
                  loadContestData()
                }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Email Verification Success Modal */}
      {showVerificationSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border-3 border-green-500 relative overflow-hidden">
            <div className="relative bg-gradient-to-b from-green-500 to-green-600 p-6 text-center">
              <div className="mb-3">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-3">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
              </div>
              <h2 className="text-lg font-bold text-white pixel-font mb-2">
                EMAIL VERIFIED!
              </h2>
              <p className="text-white text-xs pixel-font mb-1">
                Your email has been confirmed!
              </p>
              <p className="text-yellow-300 text-xs pixel-font">
                {user ? 'You can now play Perfect Slate' : 'Please sign in to start playing'}
              </p>
            </div>
            
            <div className="p-5 text-center">
              <p className="text-gray-600 text-xs pixel-font mb-4 italic">
                "Good luck out there, champ! 🏆"
              </p>
              
              {user ? (
                <button
                  onClick={() => setShowVerificationSuccess(false)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg pixel-font text-xs transition-all transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                >
                  <Trophy className="w-4 h-4" />
                  <span>PLAY NOW!</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowVerificationSuccess(false)
                    setShowAuthModal(true)
                    setAuthMode('signin')
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg pixel-font text-xs transition-all transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>SIGN IN TO PLAY</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              
              <div className="mt-3 flex items-center justify-center space-x-1 text-[10px] text-gray-500 pixel-font">
                <Zap className="w-3 h-3 text-yellow-500" />
                <span>You've earned your first free token!</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
