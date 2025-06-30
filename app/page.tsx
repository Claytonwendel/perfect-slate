'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users, DollarSign, Trophy, Clock, ArrowDown, Ticket, X, Trash2,
  ChevronDown, TrendingUp, Flame, Snowflake, Zap, AlertCircle,
  CheckCircle, Home, BarChart3, User, FileText
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
  week_number: number
  final_prize_pool: number
  total_entries: number
  status: string
}

type UserPick = {
  gameId: number
  pickId: number
  pickType: 'spread' | 'total'
  selection: string
  displayText: string
}

export default function PerfectSlateGame() {
  // State
  const [selectedSport, setSelectedSport] = useState<'NFL' | 'NCAAF'>('NFL')
  const [showSportDropdown, setShowSportDropdown] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [currentContest, setCurrentContest] = useState<Contest | null>(null)
  const [selectedPicks, setSelectedPicks] = useState<UserPick[]>([])
  const [tokensUsed, setTokensUsed] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showSlateModal, setShowSlateModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showPrizeHistory, setShowPrizeHistory] = useState(false)
  const [shakeElement, setShakeElement] = useState<string | null>(null)
  const [pickPercentages, setPickPercentages] = useState<Record<number, number>>({})
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
      // Fetch user's token balance
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
    
    // Fetch current contest
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
      
      // Fetch games for this contest
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .eq('contest_id', contestData.id)
        .order('scheduled_time')
      
      if (gamesData) {
        setGames(gamesData)
        
        // Fetch all picks for these games
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
    if (!currentContest) return
    
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

  const handlePickSelect = (gameId: number, pickType: string, selection: string, displayText: string, pickId: number) => {
    if (isSubmitted) return
    
    // Check if this is a token pick
    const pickKey = `${gameId}-${pickType}-${selection}`
    if (pickKey.includes('token')) {
      // Handle token usage
      if (tokensUsed >= 5) {
        setShakeElement(pickKey)
        setTimeout(() => setShakeElement(null), 500)
        return
      }
      setTokensUsed(prev => prev + 1)
      return
    }
    
    // Regular pick logic
    const existingPickIndex = selectedPicks.findIndex(
      p => p.gameId === gameId && p.pickType === pickType
    )
    
    if (existingPickIndex !== -1) {
      // Replace existing pick
      const newPicks = [...selectedPicks]
      newPicks[existingPickIndex] = { gameId, pickId, pickType, selection, displayText }
      setSelectedPicks(newPicks)
    } else {
      // Check if we can add this pick
      const picksForThisGame = selectedPicks.filter(p => p.gameId === gameId)
      
      if (selectedPicks.length + tokensUsed >= 10) {
        setShakeElement(pickKey)
        setTimeout(() => setShakeElement(null), 500)
        return
      }
      
      if (picksForThisGame.length >= 2) {
        setShakeElement(pickKey)
        setTimeout(() => setShakeElement(null), 500)
        return
      }
      
      setSelectedPicks([...selectedPicks, { gameId, pickId, pickType, selection, displayText }])
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
            tokensUsed
          })
        }
      )
      
      const result = await response.json()
      
      if (result.success) {
        setIsSubmitted(true)
        setShowConfirmModal(false)
        setShowSlateModal(false)
        setShowSuccessModal(true)
        
        // Refresh token balance
        checkUser()
        
        // Load pick percentages
        loadPickPercentages()
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error submitting picks:', error)
      alert('Failed to submit picks. Please try again.')
    }
  }

  const loadPickPercentages = async () => {
    // This would load the pick percentages after submission
    // For now, using mock data
    const mockPercentages: Record<number, number> = {}
    picks.forEach(pick => {
      mockPercentages[pick.id] = Math.floor(Math.random() * 100)
    })
    setPickPercentages(mockPercentages)
  }

  const isPickSelected = (gameId: number, pickType: string, selection: string) => {
    return selectedPicks.some(
      p => p.gameId === gameId && p.pickType === pickType && p.selection === selection
    )
  }

  const getPickPercentage = (pickId: number) => {
    if (!isSubmitted) return null
    return pickPercentages[pickId] || 0
  }

  const GameCard = ({ game }: { game: Game }) => {
    const gamePicks = picks.filter(p => p.game_id === game.id)
    const spreads = gamePicks.filter(p => p.pick_type === 'spread')
    const totals = gamePicks.filter(p => p.pick_type === 'total')
    
    const homeSpread = spreads.find(p => p.selection === 'home')
    const awaySpread = spreads.find(p => p.selection === 'away')
    const overTotal = totals.find(p => p.selection === 'over')
    const underTotal = totals.find(p => p.selection === 'under')
    
    return (
      <div className="bg-white border-4 border-gray-800 p-4 pixel-card mb-6 relative card-hover"
           style={{ boxShadow: '8px 8px 0px rgba(0,0,0,0.3)' }}>
        
        {/* Game Time */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-700" />
            <span className="text-sm font-bold text-gray-700 pixel-font">
              {new Date(game.scheduled_time).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
              })}
            </span>
          </div>
          
          {/* Token Button */}
          <button
            onClick={() => handlePickSelect(game.id, 'token', 'token', 'TOKEN', -1)}
            disabled={isSubmitted || tokensUsed >= 5}
            className={`
              px-3 py-1 text-xs font-bold border-2 pixel-button
              ${tokensUsed < 5 && !isSubmitted
                ? 'bg-yellow-400 border-yellow-600 hover:bg-yellow-300 cursor-pointer'
                : 'bg-gray-300 border-gray-500 cursor-not-allowed'
              }
            `}
          >
            <div className="flex items-center space-x-1">
              <Zap className="w-3 h-3" />
              <span>USE TOKEN</span>
            </div>
          </button>
        </div>
        
        {/* Teams */}
        <div className="text-center mb-4">
          <div className="text-lg font-bold text-gray-900 pixel-font">
            {game.away_team} @ {game.home_team}
          </div>
        </div>
        
        {/* Spreads */}
        <div className="mb-4">
          <div className="text-xs font-bold text-gray-600 mb-2 text-center pixel-font">SPREAD</div>
          <div className="grid grid-cols-2 gap-2">
            <PickButton
              pick={awaySpread!}
              game={game}
              displayText={`${game.away_team_short} ${game.away_spread > 0 ? '+' : ''}${game.away_spread}`}
              isSelected={isPickSelected(game.id, 'spread', 'away')}
              onSelect={() => handlePickSelect(game.id, 'spread', 'away', 
                `${game.away_team_short} ${game.away_spread > 0 ? '+' : ''}${game.away_spread}`, 
                awaySpread!.id
              )}
              percentage={getPickPercentage(awaySpread!.id)}
              disabled={isSubmitted}
            />
            <PickButton
              pick={homeSpread!}
              game={game}
              displayText={`${game.home_team_short} ${game.home_spread > 0 ? '+' : ''}${game.home_spread}`}
              isSelected={isPickSelected(game.id, 'spread', 'home')}
              onSelect={() => handlePickSelect(game.id, 'spread', 'home',
                `${game.home_team_short} ${game.home_spread > 0 ? '+' : ''}${game.home_spread}`,
                homeSpread!.id
              )}
              percentage={getPickPercentage(homeSpread!.id)}
              disabled={isSubmitted}
            />
          </div>
        </div>
        
        {/* Totals */}
        <div>
          <div className="text-xs font-bold text-gray-600 mb-2 text-center pixel-font">TOTAL</div>
          <div className="grid grid-cols-2 gap-2">
            <PickButton
              pick={overTotal!}
              game={game}
              displayText={`Over ${game.total_points}`}
              isSelected={isPickSelected(game.id, 'total', 'over')}
              onSelect={() => handlePickSelect(game.id, 'total', 'over',
                `Over ${game.total_points}`,
                overTotal!.id
              )}
              percentage={getPickPercentage(overTotal!.id)}
              disabled={isSubmitted}
            />
            <PickButton
              pick={underTotal!}
              game={game}
              displayText={`Under ${game.total_points}`}
              isSelected={isPickSelected(game.id, 'total', 'under')}
              onSelect={() => handlePickSelect(game.id, 'total', 'under',
                `Under ${game.total_points}`,
                underTotal!.id
              )}
              percentage={getPickPercentage(underTotal!.id)}
              disabled={isSubmitted}
            />
          </div>
        </div>
      </div>
    )
  }

  const PickButton = ({ 
    pick, 
    game, 
    displayText, 
    isSelected, 
    onSelect, 
    percentage,
    disabled 
  }: any) => {
    const buttonId = `${game.id}-${pick.pick_type}-${pick.selection}`
    const isShaking = shakeElement === buttonId
    
    // Determine if this pick is "hot" or "cold"
    const isHot = percentage && percentage > 70
    const isCold = percentage && percentage < 30
    
    return (
      <button
        onClick={onSelect}
        disabled={disabled}
        className={`
          relative w-full px-3 py-2 text-sm font-bold border-4 pixel-button button-hover
          ${isSelected 
            ? 'bg-yellow-400 border-yellow-600 text-white pixel-glow coin-flip' 
            : disabled
            ? 'bg-gray-300 border-gray-500 text-white cursor-not-allowed'
            : 'bg-blue-500 border-blue-700 text-white hover:scale-105 cursor-pointer'
          }
          ${isShaking ? 'shake' : ''}
        `}
        style={{ boxShadow: '4px 4px 0px rgba(0,0,0,0.2)' }}
      >
        {/* Percentage background */}
        {percentage !== null && (
          <div 
            className="absolute inset-0 bg-green-400 opacity-30"
            style={{ width: `${percentage}%` }}
          />
        )}
        
        {/* Button content */}
        <div className="relative z-10 flex justify-between items-center">
          <span className="text-outline">{displayText}</span>
          <div className="flex items-center space-x-1">
            {isHot && <Flame className="w-3 h-3 text-orange-500" />}
            {isCold && <Snowflake className="w-3 h-3 text-blue-300" />}
            {percentage !== null && (
              <span className="text-xs">{percentage}%</span>
            )}
          </div>
        </div>
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-pixel-blue flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4">
            <Ticket className="w-16 h-16 text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-white pixel-font">LOADING...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pixelated-field">
      {/* Navigation */}
      <nav className="bg-gray-900 border-b-4 border-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* Sport Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSportDropdown(!showSportDropdown)}
              className="flex items-center space-x-2 text-white pixel-font text-sm hover:text-yellow-400"
            >
              <span>PERFECT SLATE {selectedSport}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showSportDropdown && (
              <div className="absolute top-full left-0 mt-2 bg-white border-4 border-gray-800 pixel-card z-50"
                   style={{ boxShadow: '4px 4px 0px rgba(0,0,0,0.3)' }}>
                <button
                  onClick={() => {
                    setSelectedSport('NFL')
                    setShowSportDropdown(false)
                  }}
                  className="block w-full text-left px-4 py-2 pixel-font text-xs hover:bg-gray-100"
                >
                  NFL
                </button>
                <button
                  onClick={() => {
                    setSelectedSport('NCAAF')
                    setShowSportDropdown(false)
                  }}
                  className="block w-full text-left px-4 py-2 pixel-font text-xs hover:bg-gray-100"
                >
                  NCAAF
                </button>
              </div>
            )}
          </div>
          
          {/* Nav Links */}
          <div className="flex items-center space-x-6">
            <button className="text-white pixel-font text-xs hover:text-yellow-400 flex items-center space-x-1">
              <FileText className="w-4 h-4" />
              <span>RULES</span>
            </button>
            <button className="text-white pixel-font text-xs hover:text-yellow-400 flex items-center space-x-1">
              <BarChart3 className="w-4 h-4" />
              <span>LEADERBOARDS</span>
            </button>
            <button className="text-white pixel-font text-xs hover:text-yellow-400 flex items-center space-x-1">
              <User className="w-4 h-4" />
              <span>PROFILE</span>
            </button>
          </div>
        </div>
      </nav>
      
      {/* Game Header */}
      <div className="text-center py-8 px-4">
        {/* Prize Pool */}
        <button
          onClick={() => setShowPrizeHistory(true)}
          className="inline-block mb-6 transform hover:scale-105 transition-transform"
        >
          <div className="bg-green-500 border-4 border-green-700 px-8 py-4 pixel-button pulse-glow"
               style={{ boxShadow: '6px 6px 0px rgba(0,0,0,0.3)' }}>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-8 h-8" />
              <span className="text-3xl font-bold pixel-font">
                {currentContest?.final_prize_pool.toLocaleString() || '0'}
              </span>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
        </button>
        
        {/* Stats Row */}
        <div className="flex justify-center items-center space-x-8 mb-6">
          <div className="text-white">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span className="text-xl font-bold pixel-font">
                {currentContest?.total_entries || 0}
              </span>
            </div>
            <div className="text-xs pixel-font opacity-80">ENTRIES</div>
          </div>
          
          <div className="text-white">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span className="text-xl font-bold pixel-font">
                {timeRemaining}
              </span>
            </div>
            <div className="text-xs pixel-font opacity-80">TIME LEFT</div>
          </div>
        </div>
        
        {/* Today's Leaders Preview */}
        <button className="bg-purple-600 border-4 border-purple-800 px-6 py-2 pixel-button text-white hover:bg-purple-500"
                style={{ boxShadow: '4px 4px 0px rgba(0,0,0,0.3)' }}>
          <div className="flex items-center space-x-2">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-bold pixel-font">TODAY&apos;S LEADERS</span>
          </div>
        </button>
      </div>
      
      {/* Pick Your Slate */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white pixel-font mb-4">
          PICK YOUR SLATE
        </h2>
        <div className="flex justify-center space-x-2">
          <ArrowDown className="w-8 h-8 text-yellow-400 bounce-1" strokeWidth={3} />
          <ArrowDown className="w-8 h-8 text-yellow-400 bounce-2" strokeWidth={3} />
          <ArrowDown className="w-8 h-8 text-yellow-400 bounce-3" strokeWidth={3} />
        </div>
      </div>
      
      {/* Games Grid */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map(game => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
      
      {/* Floating Pick Counter */}
      {(selectedPicks.length > 0 || tokensUsed > 0) && !isSubmitted && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setShowSlateModal(true)}
            className="relative floating-counter"
          >
            <div className="w-20 h-20 bg-yellow-400 border-4 border-yellow-600 rounded-full flex flex-col items-center justify-center pixel-shadow hover:scale-110 transition-transform">
              <span className="text-2xl font-bold text-black pixel-font">
                {selectedPicks.length + tokensUsed}
              </span>
              <span className="text-xs pixel-font">PICKS</span>
            </div>
            {selectedPicks.length + tokensUsed === 10 && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 border-2 border-green-700 rounded-full flex items-center justify-center animate-bounce">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        </div>
      )}
      
      {/* Slate Modal */}
      {showSlateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-gray-800 p-6 pixel-card max-w-md w-full max-h-96 overflow-y-auto"
               style={{ boxShadow: '8px 8px 0px rgba(0,0,0,0.3)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold pixel-font">
                YOUR SLATE ({selectedPicks.length + tokensUsed}/10)
              </h3>
              <button onClick={() => setShowSlateModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Token Balance */}
            {user && (
              <div className="bg-yellow-100 border-2 border-yellow-400 p-3 mb-4 pixel-button">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold pixel-font">TOKEN BALANCE:</span>
                  <span className="text-lg font-bold pixel-font">{tokenBalance}</span>
                </div>
                <div className="text-xs pixel-font mt-1 text-gray-600">
                  Using {tokensUsed} token{tokensUsed !== 1 ? 's' : ''} this slate
                </div>
              </div>
            )}
            
            {/* Picks List */}
            <div className="space-y-2 mb-4">
              {selectedPicks.map((pick, index) => (
                <div key={index} className="bg-gray-100 border-2 border-gray-400 p-3 pixel-button flex justify-between items-center">
                  <span className="text-sm font-bold pixel-font">{pick.displayText}</span>
                  <button onClick={() => removePick(index)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              ))}
              
              {/* Token slots */}
              {Array.from({ length: tokensUsed }).map((_, index) => (
                <div key={`token-${index}`} className="bg-yellow-100 border-2 border-yellow-400 p-3 pixel-button">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-bold pixel-font">TOKEN PICK</span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={() => setShowSlateModal(false)}
                className="flex-1 bg-gray-500 border-4 border-gray-700 py-3 px-4 font-bold text-sm pixel-button text-white hover:bg-gray-400"
              >
                KEEP BUILDING
              </button>
              {selectedPicks.length + tokensUsed === 10 && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 bg-green-500 border-4 border-green-700 py-3 px-4 font-bold text-sm pixel-button text-white hover:bg-green-400"
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
          <div className="bg-white border-4 border-gray-800 p-8 pixel-card max-w-sm w-full"
               style={{ boxShadow: '8px 8px 0px rgba(0,0,0,0.3)' }}>
            <div className="text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-xl font-bold pixel-font mb-4">LOCK IT IN?</h3>
              <p className="text-sm pixel-font text-gray-700 mb-6">
                This slate is FINAL! No changes allowed!
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-gray-500 border-4 border-gray-700 py-3 px-4 font-bold text-sm pixel-button text-white hover:bg-gray-400"
                >
                  WAIT
                </button>
                <button
                  onClick={submitSlate}
                  className="flex-1 bg-green-500 border-4 border-green-700 py-3 px-4 font-bold text-sm pixel-button text-white hover:bg-green-400"
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
          <div className="bg-white border-4 border-gray-800 p-8 pixel-card"
               style={{ boxShadow: '8px 8px 0px rgba(0,0,0,0.3)' }}>
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
                className="bg-blue-500 border-4 border-blue-700 px-6 py-3 pixel-button text-white font-bold hover:bg-blue-400"
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
