'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users, DollarSign, Trophy, Clock, Ticket, X, Trash2,
  ChevronDown, Zap, AlertCircle, FileText, BarChart3, 
  User, Coins, Star, Cloud
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Type definitions
type Game = {
  id: number
  contest_id: number
  sport: 'NFL' | 'NCAAF'
  home_team: string
  away_team: string
  home_team_short: string
  away_team_short: string
  scheduled_time: string
  home_spread: number
  away_spread: number
  total_points: number
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
  sport: 'NFL' | 'NCAAF'
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
    'Commanders', 'Cardinals', '49ers', 'Seahawks', 'Rams', 'Saints',
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
  
  return city
}

export default function PerfectSlateGame() {
  // State
  const [selectedSport, setSelectedSport] = useState<'NFL' | 'NCAAF'>('NFL')
  const [showSportDropdown, setShowSportDropdown] = useState(false)
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
        .order('scheduled_time')
      
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
    
    // Get city names
    const homeCity = getCityName(game.home_team)
    const awayCity = getCityName(game.away_team)
    
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-lg border-4 ${hasToken ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'} hover:shadow-xl transition-all duration-300`}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm pixel-font">
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
            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm pixel-font transition-all ${
              hasToken 
                ? 'bg-yellow-400 text-yellow-900 shadow-md' 
                : 'bg-gray-100 hover:bg-yellow-100 text-gray-700'
            }`}
          >
            <Zap className={`w-4 h-4 ${hasToken ? 'animate-pulse' : ''}`} />
            <span>{hasToken ? 'TOKEN USED' : 'USE TOKEN'}</span>
          </button>
        </div>
        
        {/* Teams */}
        <div className="text-center mb-6">
          <div className="text-xl font-bold pixel-font">
            <span className="text-gray-700">{awayCity}</span>
            <span className="text-gray-500 mx-2">@</span>
            <span className="text-gray-700">{homeCity}</span>
          </div>
        </div>
        
        {/* Picks Grid */}
        <div className="space-y-4">
          {/* Spread */}
          <div>
            <div className="text-center text-xs font-bold text-gray-500 mb-2 pixel-font">SPREAD</div>
            <div className="grid grid-cols-2 gap-3">
              <PickButton
                text={`${awayCity} ${game.away_spread > 0 ? '+' : ''}${game.away_spread}`}
                isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'spread' && p.selection === 'away')}
                onClick={() => handlePickSelect(game.id, 'spread', 'away', 
                  `${awayCity} ${game.away_spread > 0 ? '+' : ''}${game.away_spread}`, 
                  awaySpread!.id
                )}
                disabled={isGameDisabled}
              />
              <PickButton
                text={`${homeCity} ${game.home_spread > 0 ? '+' : ''}${game.home_spread}`}
                isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'spread' && p.selection === 'home')}
                onClick={() => handlePickSelect(game.id, 'spread', 'home',
                  `${homeCity} ${game.home_spread > 0 ? '+' : ''}${game.home_spread}`,
                  homeSpread!.id
                )}
                disabled={isGameDisabled}
              />
            </div>
          </div>
          
          {/* Total */}
          <div>
            <div className="text-center text-xs font-bold text-gray-500 mb-2 pixel-font">TOTAL RUNS</div>
            <div className="grid grid-cols-2 gap-3">
              <PickButton
                text={`Over ${game.total_points}`}
                isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'total' && p.selection === 'over')}
                onClick={() => handlePickSelect(game.id, 'total', 'over',
                  `Over ${game.total_points}`,
                  overTotal!.id
                )}
                disabled={isGameDisabled}
              />
              <PickButton
                text={`Under ${game.total_points}`}
                isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'total' && p.selection === 'under')}
                onClick={() => handlePickSelect(game.id, 'total', 'under',
                  `Under ${game.total_points}`,
                  underTotal!.id
                )}
                disabled={isGameDisabled}
              />
            </div>
          </div>
        </div>
        
        {/* Token Indicator */}
        {hasToken && (
          <div className="mt-4 text-center">
            <span className="text-xs text-yellow-700 pixel-font animate-pulse">
              🎯 TOKEN APPLIED - NO PICKS NEEDED
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
          relative px-4 py-3 rounded-xl pixel-font text-sm font-bold transition-all duration-200
          ${isSelected 
            ? 'bg-blue-500 text-white shadow-lg transform scale-105' 
            : disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gray-100 hover:bg-blue-100 text-gray-700 hover:shadow-md hover:scale-102'
          }
        `}
      >
        {text}
        {isSelected && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-400 rounded-full flex items-center justify-center">
            <Star className="w-3 h-3 text-white" fill="white" />
          </div>
        )}
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-400 to-green-400 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4">
            <Ticket className="w-16 h-16 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white pixel-font">LOADING...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-400 to-green-500 relative overflow-hidden">
      {/* Animated Clouds */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Cloud className="absolute top-10 left-10 text-white opacity-20 w-32 h-32 animate-float-slow" />
        <Cloud className="absolute top-20 right-20 text-white opacity-20 w-24 h-24 animate-float" />
        <Cloud className="absolute top-32 left-1/3 text-white opacity-15 w-40 h-40 animate-float-slow" />
        <Cloud className="absolute top-16 right-1/3 text-white opacity-25 w-20 h-20 animate-float" />
      </div>
      
      {/* Navigation - Matching Sky Blue */}
      <nav className="bg-gradient-to-b from-blue-400 to-blue-500 relative z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            {/* Sport Selector */}
            <div className="relative">
              <button
                onClick={() => setShowSportDropdown(!showSportDropdown)}
                className="flex items-center space-x-2 text-white pixel-font text-lg hover:text-yellow-300 transition-colors"
              >
                <span>PERFECT SLATE {selectedSport}</span>
                <ChevronDown className="w-5 h-5" />
              </button>
              
              {showSportDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl overflow-hidden">
                  <button
                    onClick={() => {
                      setSelectedSport('NFL')
                      setShowSportDropdown(false)
                    }}
                    className="block w-full text-left px-6 py-3 pixel-font text-sm hover:bg-blue-50 transition-colors"
                  >
                    NFL
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSport('NCAAF')
                      setShowSportDropdown(false)
                    }}
                    className="block w-full text-left px-6 py-3 pixel-font text-sm hover:bg-blue-50 transition-colors"
                  >
                    NCAAF
                  </button>
                </div>
              )}
            </div>
            
            {/* Nav Links */}
            <div className="flex items-center space-x-6">
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
          </div>
        </div>
      </nav>
      
      {/* Header Content */}
      <div className="relative z-10 py-8">
        <div className="text-center">
          {/* Prize Pool */}
          <button
            onClick={() => setShowPrizeHistory(true)}
            className="inline-block mb-6 group"
          >
            <div className="bg-yellow-400 rounded-2xl px-8 py-4 shadow-xl transform group-hover:scale-105 transition-all duration-300">
              <div className="flex items-center space-x-3">
                <Coins className="w-8 h-8 text-yellow-700" />
                <span className="text-3xl font-bold pixel-font text-yellow-900">
                  ${currentContest?.final_prize_pool.toLocaleString() || '0'}
                </span>
                <AlertCircle className="w-5 h-5 text-yellow-700" />
              </div>
            </div>
          </button>
          
          {/* Stats */}
          <div className="flex justify-center items-center space-x-8 text-white">
            <div>
              <div className="flex items-center justify-center space-x-2 mb-1">
                <Users className="w-5 h-5" />
                <span className="text-2xl font-bold pixel-font">
                  {currentContest?.total_entries || 0}
                </span>
              </div>
              <div className="text-xs pixel-font opacity-90">ENTRIES</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center space-x-2 mb-1">
                <Clock className="w-5 h-5" />
                <span className="text-2xl font-bold pixel-font">
                  {timeRemaining}
                </span>
              </div>
              <div className="text-xs pixel-font opacity-90">TIME LEFT</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Games Grid */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 pb-32">
        <div className="space-y-4">
          {games.map(game => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
      
      {/* Floating Pick Counter */}
      {(selectedPicks.length > 0 || gamesWithTokens.size > 0) && !isSubmitted && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setShowSlateModal(true)}
            className="bg-white rounded-full shadow-xl p-6 hover:scale-110 transition-transform duration-300"
          >
            <div className="text-center">
              <div className="text-3xl font-bold pixel-font text-gray-800">
                {selectedPicks.length + gamesWithTokens.size}
              </div>
              <div className="text-xs pixel-font text-gray-600">PICKS</div>
            </div>
            {selectedPicks.length + gamesWithTokens.size === 10 && (
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
          <div className="bg-white rounded-2xl p-8 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold pixel-font">
                YOUR SLATE ({selectedPicks.length + gamesWithTokens.size}/10)
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
                      <Zap className="w-4 h-4 text-yellow-600" />
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
            <div className="flex space-x-3">
              <button
                onClick={() => setShowSlateModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 py-3 px-4 rounded-xl font-bold text-sm pixel-font transition-colors"
              >
                KEEP BUILDING
              </button>
              {selectedPicks.length + gamesWithTokens.size === 10 && (
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
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full">
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
          <div className="bg-white rounded-2xl p-8">
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
      
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-30px) translateX(10px); }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-float-slow {
          animation: float-slow 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
