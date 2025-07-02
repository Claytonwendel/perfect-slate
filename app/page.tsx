'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users, DollarSign, Trophy, Clock, X, Trash2,
  ChevronDown, AlertCircle, FileText, BarChart3, 
  User, Coins, Zap, Menu, CircleDollarSign
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Type definitions
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

// Extract city name from full team name
const getCityName = (teamName: string): string => {
  // Remove common team suffixes
  const suffixes = [
    'Chiefs', 'Lions', 'Packers', 'Bears', 'Vikings', 'Buccaneers', 
    'Patriots', 'Bills', 'Jets', 'Dolphins', 'Ravens', 'Bengals', 
    'Browns', 'Steelers', 'Texans', 'Colts', 'Jaguars', 'Titans',
    'Broncos', 'Raiders', 'Chargers', 'Cowboys', 'Eagles', 'Giants',
    'Commanders', '49ers', 'Seahawks', 'Rams', 'Saints',
    'Falcons', 'Panthers', 'Rays', 'Orioles', 'Blue Jays', 'Yankees',
    'Red Sox', 'Guardians', 'Tigers', 'Royals', 'Twins', 'White Sox',
    'Astros', 'Athletics', 'Angels', 'Mariners', 'Rangers', 'Phillies',
    'Mets', 'Nationals', 'Marlins', 'Braves', 'Brewers', 'Cubs', 'Reds',
    'Pirates', 'Cardinals', 'Dodgers', 'Giants', 'Padres', 'Rockies',
    'Diamondbacks'
  ]
  
  let city = teamName
  suffixes.forEach(suffix => {
    if (city.endsWith(suffix)) {
      city = city.replace(suffix, '').trim()
    }
  })
  
  // Shorten long city names for mobile
  const shortNames: Record<string, string> = {
    'San Francisco': 'SF',
    'Los Angeles': 'LA',
    'New York': 'NY',
    'Tampa Bay': 'Tampa',
    'Green Bay': 'GB',
    'New England': 'NE',
    'Kansas City': 'KC',
    'Las Vegas': 'LV',
    'San Diego': 'SD',
    'North Carolina': 'UNC',
    'South Carolina': 'SC'
  }
  
  return shortNames[city] || city
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

// Helper function to apply no-tie logic
const applyNoTieLogic = (value: number, isUnder: boolean = false): number => {
  // For spreads: add 0.5 to underdogs, subtract 0.5 from favorites
  // For totals: add 0.5 to overs, subtract 0.5 from unders
  if (isUnder) {
    // For under bets, we subtract 0.5
    return Math.floor(value) === value ? value - 0.5 : value
  } else {
    // For over bets and positive spreads (underdogs), we add 0.5
    // For negative spreads (favorites), we subtract 0.5
    if (value > 0) {
      return Math.floor(value) === value ? value + 0.5 : value
    } else if (value < 0) {
      return Math.floor(value) === value ? value - 0.5 : value
    }
    return value
  }
}

export default function PerfectSlateGame() {
  // State
  const [selectedSport, setSelectedSport] = useState<'NFL' | 'NCAAF' | 'MLB'>('MLB')
  const [showSportDropdown, setShowSportDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
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
  const [user, setUser] = useState<any>(null)
  const [tokenBalance, setTokenBalance] = useState(0)

  // Fetch initial data
  useEffect(() => {
    loadContestData()
    checkUser()
  }, [selectedSport])

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      updateTimeRemaining()
    }, 1000)
    return () => clearInterval(timer)
  }, [currentContest])

  // Refresh scores for live games
  useEffect(() => {
    const scoreInterval = setInterval(() => {
      if (games.some(g => g.status === 'in_progress')) {
        loadContestData()
      }
    }, 30000) // Refresh every 30 seconds
    return () => clearInterval(scoreInterval)
  }, [games])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      const { data: userData } = await supabase
        .from('users')
        .select('token_balance')
        .eq('id', user.id)
        .single()
      
      if (userData) {
        setTokenBalance(userData.token_balance)
      }
    }
  }

  const loadContestData = async () => {
    setIsLoading(true)
    
    const { data: contestData } = await supabase
      .from('contests')
      .select('*')
      .eq('sport', selectedSport)
      .eq('status', 'open')
      .order('week_number', { ascending: false })
      .limit(1)
      .single()
    
    if (contestData) {
      setCurrentContest(contestData)
      
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .eq('contest_id', contestData.id)
        .order('scheduled_time', { ascending: true }) // Sort by earliest first!
      
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
    }
    
    setIsLoading(false)
  }

  const updateTimeRemaining = () => {
    if (!currentContest || !currentContest.lock_time) return
    
    const now = new Date()
    const lockTime = new Date(currentContest.lock_time)
    const diff = lockTime.getTime() - now.getTime()
    
    if (diff <= 0) {
      setTimeRemaining('LOCKED')
      return
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    setTimeRemaining(`${hours}h ${minutes}m`)
  }

  const handlePickSelect = (gameId: number, pickType: 'spread' | 'total', selection: string, displayText: string, pickId: number) => {
    if (isSubmitted || gamesWithTokens.has(gameId)) return
    
    const existingPickIndex = selectedPicks.findIndex(
      p => p.gameId === gameId && p.pickType === pickType
    )
    
    if (existingPickIndex !== -1) {
      const newPicks = [...selectedPicks]
      newPicks[existingPickIndex] = { gameId, pickId, pickType, selection, displayText }
      setSelectedPicks(newPicks)
    } else {
      const picksForThisGame = selectedPicks.filter(p => p.gameId === gameId)
      
      if (selectedPicks.length + gamesWithTokens.size >= 10) {
        return
      }
      
      if (picksForThisGame.length >= 2) {
        return
      }
      
      setSelectedPicks([...selectedPicks, { gameId, pickId, pickType, selection, displayText }])
    }
  }

  const handleTokenToggle = (gameId: number) => {
    if (isSubmitted) return
    
    const newTokenGames = new Set(gamesWithTokens)
    
    if (newTokenGames.has(gameId)) {
      // Remove token
      newTokenGames.delete(gameId)
      setGamesWithTokens(newTokenGames)
    } else {
      // Add token
      if (selectedPicks.length + newTokenGames.size >= 10) return
      if (gamesWithTokens.size >= 5) return
      
      // Remove any picks from this game
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
    const isGameDisabled = hasToken || isSubmitted
    const isGameStarted = game.status === 'in_progress' || game.status === 'final'
    
    // Get city names
    const homeCity = getCityName(game.home_team)
    const awayCity = getCityName(game.away_team)
    
    // Apply no-tie logic to spreads and totals
    const homeSpreadDisplay = applyNoTieLogic(game.home_spread)
    const awaySpreadDisplay = applyNoTieLogic(game.away_spread)
    const overDisplay = applyNoTieLogic(game.total_points)
    const underDisplay = applyNoTieLogic(game.total_points, true)
    
    return (
      <div className={`bg-white rounded-2xl p-4 md:p-6 shadow-lg border-4 ${hasToken ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'} hover:shadow-xl transition-all duration-300`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="text-xs sm:text-sm pixel-font">
              {new Date(game.scheduled_time).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                timeZone: 'America/New_York'
              })} ET
            </span>
          </div>
          
          {/* Token Button */}
          <button
            onClick={() => handleTokenToggle(game.id)}
            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs sm:text-sm pixel-font transition-all ${
              hasToken 
                ? 'bg-yellow-400 text-yellow-900 shadow-md' 
                : 'bg-gray-100 hover:bg-yellow-100 text-gray-700'
            }`}
          >
            <TokenIcon className={`w-4 h-4 ${hasToken ? 'animate-pulse' : ''}`} />
            <span className="whitespace-nowrap">{hasToken ? 'TOKEN USED' : 'USE TOKEN'}</span>
          </button>
        </div>
        
        {/* Teams & Score */}
        <div className="text-center mb-4 md:mb-6">
          <div className="text-base sm:text-lg md:text-xl font-bold pixel-font">
            <span className="text-gray-700">{awayCity}</span>
            <span className="text-gray-500 mx-2">@</span>
            <span className="text-gray-700">{homeCity}</span>
          </div>
          
          {/* Live Score Display */}
          {isGameStarted && (
            <div className="mt-2 text-2xl font-bold pixel-font">
              <span className={game.away_score! > game.home_score! ? 'text-green-600' : 'text-gray-700'}>
                {game.away_score || 0}
              </span>
              <span className="text-gray-500 mx-3">-</span>
              <span className={game.home_score! > game.away_score! ? 'text-green-600' : 'text-gray-700'}>
                {game.home_score || 0}
              </span>
            </div>
          )}
          
          {game.status === 'in_progress' && (
            <div className="mt-1">
              <span className="text-xs pixel-font text-red-600 animate-pulse">LIVE</span>
            </div>
          )}
          
          {game.status === 'final' && (
            <div className="mt-1">
              <span className="text-xs pixel-font text-gray-600">FINAL</span>
            </div>
          )}
        </div>
        
        {/* Picks Grid - Show odds if game hasn't started */}
        {!isGameStarted && (
          <div className="space-y-3 md:space-y-4">
            {/* Spread */}
            <div>
              <div className="text-center text-xs font-bold text-gray-500 mb-2 pixel-font">SPREAD</div>
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <PickButton
                  text={`${awayCity} ${awaySpreadDisplay > 0 ? '+' : ''}${awaySpreadDisplay}`}
                  isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'spread' && p.selection === 'away')}
                  onClick={() => handlePickSelect(game.id, 'spread', 'away', 
                    `${awayCity} ${awaySpreadDisplay > 0 ? '+' : ''}${awaySpreadDisplay}`, 
                    awaySpread!.id
                  )}
                  disabled={isGameDisabled}
                />
                <PickButton
                  text={`${homeCity} ${homeSpreadDisplay > 0 ? '+' : ''}${homeSpreadDisplay}`}
                  isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'spread' && p.selection === 'home')}
                  onClick={() => handlePickSelect(game.id, 'spread', 'home',
                    `${homeCity} ${homeSpreadDisplay > 0 ? '+' : ''}${homeSpreadDisplay}`,
                    homeSpread!.id
                  )}
                  disabled={isGameDisabled}
                />
              </div>
            </div>
            
            {/* Total */}
            <div>
              <div className="text-center text-xs font-bold text-gray-500 mb-2 pixel-font">{game.sport === 'MLB' ? 'TOTAL RUNS' : 'TOTAL POINTS'}</div>
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <PickButton
                  text={`Over ${overDisplay}`}
                  isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'total' && p.selection === 'over')}
                  onClick={() => handlePickSelect(game.id, 'total', 'over',
                    `Over ${overDisplay}`,
                    overTotal!.id
                  )}
                  disabled={isGameDisabled}
                />
                <PickButton
                  text={`Under ${underDisplay}`}
                  isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'total' && p.selection === 'under')}
                  onClick={() => handlePickSelect(game.id, 'total', 'under',
                    `Under ${underDisplay}`,
                    underTotal!.id
                  )}
                  disabled={isGameDisabled}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Token Indicator */}
        {hasToken && (
          <div className="mt-4 text-center">
            <span className="text-xs text-yellow-700 pixel-font animate-pulse">
              TOKEN APPLIED - NO PICKS NEEDED
            </span>
          </div>
        )}
      </div>
    )
  }

  const PickButton = ({ text, isSelected, onClick, disabled }: any) => {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          relative px-3 md:px-4 py-2 md:py-3 rounded-xl pixel-font text-xs md:text-sm font-bold transition-all duration-200 overflow-hidden
          ${isSelected 
            ? 'bg-yellow-400 border-2 border-yellow-600 text-yellow-900 shadow-lg' 
            : disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gray-100 hover:bg-blue-100 text-gray-700 hover:shadow-md'
          }
        `}
      >
        <span className="relative z-10 flex items-center justify-center space-x-1">
          {isSelected && <Zap className="w-3 h-3 md:w-4 md:h-4" />}
          <span className="truncate">{text}</span>
        </span>
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sky-400 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4">
            <CircleDollarSign className="w-16 h-16 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white pixel-font">LOADING...</h2>
        </div>
      </div>
    )
  }

  const totalPicks = selectedPicks.length + gamesWithTokens.size

  return (
    <div className="min-h-screen relative">
      {/* Sky Blue Top Section */}
      <div className="bg-sky-400 absolute top-0 left-0 right-0 h-[450px]"></div>
      
      {/* Green Field Bottom Section */}
      <div className="bg-green-500 absolute top-[450px] left-0 right-0 bottom-0"></div>
      
      {/* Navigation */}
      <nav className="relative z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            {/* Sport Selector */}
            <div className="relative">
              <button
                onClick={() => setShowSportDropdown(!showSportDropdown)}
                className="flex items-center space-x-2 text-white pixel-font text-sm md:text-lg hover:text-yellow-300 transition-colors"
              >
                <span>PERFECT SLATE {selectedSport}</span>
                <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              
              {showSportDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl overflow-hidden z-50">
                  <button
                    onClick={() => {
                      setSelectedSport('MLB')
                      setShowSportDropdown(false)
                    }}
                    className="block w-full text-left px-6 py-3 pixel-font text-xs md:text-sm hover:bg-blue-50 transition-colors"
                  >
                    MLB
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSport('NFL')
                      setShowSportDropdown(false)
                    }}
                    className="block w-full text-left px-6 py-3 pixel-font text-xs md:text-sm hover:bg-blue-50 transition-colors"
                  >
                    NFL
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSport('NCAAF')
                      setShowSportDropdown(false)
                    }}
                    className="block w-full text-left px-6 py-3 pixel-font text-xs md:text-sm hover:bg-blue-50 transition-colors"
                  >
                    NCAAF
                  </button>
                </div>
              )}
            </div>
            
            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center space-x-6">
              <button className="text-white pixel-font text-sm hover:text-yellow-300 transition-colors flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>RULES</span>
              </button>
              <button className="text-white pixel-font text-sm hover:text-yellow-300 transition-colors flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>LEADERBOARDS</span>
              </button>
              <button className="text-white pixel-font text-sm hover:text-yellow-300 transition-colors flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>PROFILE</span>
              </button>
            </div>
            
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
          
          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden mt-4 pb-4 border-t border-blue-300 pt-4">
              <button className="block w-full text-left text-white pixel-font text-sm py-2 hover:text-yellow-300 transition-colors">
                RULES
              </button>
              <button className="block w-full text-left text-white pixel-font text-sm py-2 hover:text-yellow-300 transition-colors">
                LEADERBOARDS
              </button>
              <button className="block w-full text-left text-white pixel-font text-sm py-2 hover:text-yellow-300 transition-colors">
                PROFILE
              </button>
            </div>
          )}
        </div>
      </nav>
      
      {/* Header Content - Sky Blue Background */}
      <div className="relative z-10 pb-20">
        <div className="text-center pt-8">
          {/* Prize Pool */}
          <button
            onClick={() => setShowPrizeHistory(true)}
            className="inline-block mb-6 group"
          >
            <div className="bg-yellow-400 rounded-2xl px-6 md:px-8 py-3 md:py-4 shadow-xl transform group-hover:scale-105 transition-all duration-300">
              <div className="flex items-center space-x-2 md:space-x-3">
                <Coins className="w-6 h-6 md:w-8 md:h-8 text-yellow-700" />
                <span className="text-xl md:text-3xl font-bold pixel-font text-yellow-900">
                  ${currentContest?.final_prize_pool.toLocaleString() || '0'}
                </span>
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-yellow-700" />
              </div>
            </div>
          </button>
          
          {/* Stats */}
          <div className="flex justify-center items-center space-x-6 md:space-x-8 text-white">
            <div>
              <div className="flex items-center justify-center space-x-2 mb-1">
                <Users className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-lg md:text-2xl font-bold pixel-font">
                  {currentContest?.total_entries || 0}
                </span>
              </div>
              <div className="text-xs pixel-font opacity-90">ENTRIES</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center space-x-2 mb-1">
                <Clock className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-lg md:text-2xl font-bold pixel-font">
                  {timeRemaining}
                </span>
              </div>
              <div className="text-xs pixel-font opacity-90">TIME LEFT</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Games Grid - Starts in Green */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 pb-32 -mt-10">
        <div className="space-y-4">
          {games.map(game => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
      
      {/* Floating Pick Counter */}
      {(totalPicks > 0) && !isSubmitted && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setShowSlateModal(true)}
            className={`${totalPicks > 0 ? 'bg-yellow-400' : 'bg-white'} rounded-full shadow-xl p-4 md:p-6 hover:scale-110 transition-all duration-300`}
          >
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold pixel-font text-gray-800">
                {totalPicks}
              </div>
              <div className="text-xs pixel-font text-gray-600">PICKS</div>
            </div>
            {totalPicks === 10 && (
              <div className="absolute -top-2 -right-2 animate-bounce">
                <div className="bg-green-400 rounded-full p-2">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
          </button>
        </div>
      )}
      
      {/* Slate Modal */}
      {showSlateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold pixel-font">
                YOUR SLATE ({totalPicks}/10)
              </h3>
              <button onClick={() => setShowSlateModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Token Balance */}
            {user && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold pixel-font">TOKEN BALANCE:</span>
                  <span className="text-xl font-bold pixel-font text-yellow-700">{tokenBalance}</span>
                </div>
                <div className="text-xs pixel-font mt-1 text-gray-600">
                  Using {gamesWithTokens.size} token{gamesWithTokens.size !== 1 ? 's' : ''} this slate
                </div>
              </div>
            )}
            
            {/* Picks List */}
            <div className="space-y-3 mb-6">
              {selectedPicks.map((pick, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-sm font-bold pixel-font">{pick.displayText}</span>
                  <button onClick={() => removePick(index)}>
                    <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                  </button>
                </div>
              ))}
              
              {/* Token Games */}
              {Array.from(gamesWithTokens).map((gameId) => {
                const game = games.find(g => g.id === gameId)
                if (!game) return null
                return (
                  <div key={`token-${gameId}`} className="bg-yellow-50 rounded-xl p-4 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <TokenIcon className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-bold pixel-font">
                        TOKEN: {getCityName(game.away_team)} @ {getCityName(game.home_team)}
                      </span>
                    </div>
                    <button onClick={() => handleTokenToggle(gameId)}>
                      <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                    </button>
                  </div>
                )
              })}
            </div>
            
            {/* Actions */}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => setShowSlateModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 py-3 px-4 rounded-xl font-bold text-sm pixel-font transition-colors"
              >
                KEEP BUILDING
              </button>
              {totalPicks === 10 && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 bg-green-500 hover:bg-green-600 py-3 px-4 rounded-xl font-bold text-sm pixel-font text-white transition-colors"
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
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-sm w-full">
            <div className="text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-xl font-bold pixel-font mb-4">LOCK IT IN?</h3>
              <p className="text-sm pixel-font text-gray-700 mb-6">
                This slate is FINAL! No changes allowed!
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 py-3 px-4 rounded-xl font-bold text-sm pixel-font transition-colors"
                >
                  WAIT
                </button>
                <button
                  onClick={submitSlate}
                  className="flex-1 bg-green-500 hover:bg-green-600 py-3 px-4 rounded-xl font-bold text-sm pixel-font text-white transition-colors"
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
          <div className="bg-white rounded-2xl p-6 md:p-8">
            <div className="text-center">
              <div className="mb-4 animate-bounce">
                <Trophy className="w-16 h-16 mx-auto text-yellow-500" />
              </div>
              <h3 className="text-2xl font-bold pixel-font mb-2">SLATE LOCKED!</h3>
              <p className="text-sm pixel-font text-gray-700 mb-4">
                Good luck! Check back after games end.
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-xl text-white font-bold pixel-font transition-colors"
              >
                LET&apos;S GO!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
