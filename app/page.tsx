'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, DollarSign, Trophy, Clock, X, Trash2,
  ChevronDown, AlertCircle, FileText, BarChart3,
  User, Coins, Zap, Menu, CircleDollarSign, Calendar,
  CheckCircle, LogOut, ArrowRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'

/* ------------------------------------------
   Cloud assets (Supabase Storage)
   ------------------------------------------ */
// TODO: put your real project ref below
const CLOUD_BASE =
  'https://<your-project-ref>.supabase.co/storage/v1/object/public/Clouds'
const CLOUD_COUNT = 16 // cloud-01.svg ... cloud-16.svg
const cloudUrl = (i: number) =>
  `${CLOUD_BASE}/cloud-${String(i + 1).padStart(2, '0')}.svg`

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function pickIndices(seed: number, howMany: number) {
  const r = mulberry32(seed)
  const idxs = Array.from({ length: _COUNT }, (_, i) => i)
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[idxs[i], idxs[j]] = [idxs[j], idxs[i]]
  }
  return idxs.slice(0, howMany)
}

/* ------------------------------------------
   Types
   ------------------------------------------ */
type Sport = 'NFL' | 'NCAAF' | 'MLB'

type Team = {
  id: number
  sport: Sport
  team_name: string
  city: string
  abbreviation: string
  primary_color: string
  secondary_color: string
  logo_url: string
  pixelated_logo_url?: string
}

type Game = {
  id: number
  contest_id: number
  sport: Sport
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
  sport: Sport
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

/* ------------------------------------------
   Utilities
   ------------------------------------------ */
const applyNoTieLogic = (v: number) => (Math.floor(v) === v ? v + 0.5 : v)

const getCityName = (teamName: string): string => {
  const suffixes = [
    'Chiefs','Lions','Packers','Bears','Vikings','Buccaneers','Patriots','Bills',
    'Jets','Dolphins','Ravens','Bengals','Browns','Steelers','Texans','Colts',
    'Jaguars','Titans','Broncos','Raiders','Chargers','Cowboys','Eagles','Giants',
    'Commanders','49ers','Seahawks','Rams','Saints','Falcons','Panthers','Rays',
    'Orioles','Blue Jays','Yankees','Red Sox','Guardians','Tigers','Royals','Twins',
    'White Sox','Astros','Athletics','Angels','Mariners','Rangers','Phillies','Mets',
    'Nationals','Marlins','Braves','Brewers','Cubs','Reds','Pirates','Cardinals',
    'Dodgers','Giants','Padres','Rockies','Diamondbacks'
  ]
  let city = teamName
  suffixes.forEach(s => {
    if (city.endsWith(s)) city = city.replace(s, '').trim()
  })
  const shortMap: Record<string,string> = {
    'San Francisco':'SF','Los Angeles':'LA','New York':'NY','Tampa Bay':'Tampa',
    'Green Bay':'GB','New England':'NE','Kansas City':'KC','Las Vegas':'LV','San Diego':'SD'
  }
  return shortMap[city] || city
}

const normalize = (s?: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()

const buildTeamIndex = (teams: Team[]) => {
  const idx = new Map<string, Team>()
  for (const t of teams) {
    const abbr = normalize(t.abbreviation)
    const city = normalize(t.city)
    const nick = normalize(t.team_name)

    if (abbr) idx.set(abbr, t)
    if (city) idx.set(city, t)
    if (nick) idx.set(nick, t)
    if (city && nick) idx.set(`${city} ${nick}`, t)
    const synth = normalize(`${t.city} ${t.team_name}`)
    if (synth) idx.set(synth, t)

    // helpful aliases
    if (t.city === 'New England') idx.set('patriots', t)
    if (t.city === 'Tampa Bay')   idx.set('buccaneers', t)
    if (t.city === 'Green Bay')   idx.set('packers', t)
    if (t.city === 'San Francisco') idx.set('49ers', t)
    if (t.city === 'Los Angeles' && t.team_name === 'Chargers') idx.set('lac', t)
    if (t.city === 'Los Angeles' && t.team_name === 'Rams')     idx.set('lar', t)
    if (t.city === 'New York' && t.team_name === 'Jets')  idx.set('nyj', t)
    if (t.city === 'New York' && t.team_name === 'Giants')idx.set('nyg', t)
    if (t.city === 'Washington') idx.set('commanders', t)
    if (t.city === 'Arizona')    idx.set('cardinals', t)
    if (t.city === 'Charlotte')  idx.set('panthers', t)
  }
  return idx
}

/* ------------------------------------------
   Tiny UI bits
   ------------------------------------------ */
const TokenIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold">T</text>
  </svg>
)

/* ------------------------------------------
   Page
   ------------------------------------------ */
export default function PerfectSlateGame() {
  const router = useRouter()

  const [selectedSport, setSelectedSport] = useState<Sport>('NFL')
  const [showSportDropdown, setShowSportDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [teams, setTeams] = useState<Team[]>([])

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
  const [contestStatus, setContestStatus] = useState<'pre-contest'|'active'|'locked'>('active')
  const [user, setUser] = useState<any>(null)
  const [tokenBalance, setTokenBalance] = useState(0)

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin'|'signup'>('signup')
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const teamIndex = useMemo(() => buildTeamIndex(teams), [teams])
  const resolveTeam = (nameOrAbbr?: string): Team | undefined =>
    nameOrAbbr ? teamIndex.get(normalize(nameOrAbbr)) : undefined

  /* ------------ Auth & initial load ------------ */
  useEffect(() => {
    const handleAuthFlow = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const verified = urlParams.get('verified')
      const authType = urlParams.get('auth')

      if (authType === 'fragment') {
        const hash = window.location.hash
        if (hash.includes('access_token=')) {
          try {
            const { data } = await supabase.auth.getSession()
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
        await loadContestData()
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
      await loadContestData()
    }

    handleAuthFlow()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user)
        await loadUserProfile(session.user.id)
        if (!showVerificationSuccess) setShowVerificationSuccess(true)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setTokenBalance(0)
        setSelectedPicks([])
        setGamesWithTokens(new Set())
        setIsSubmitted(false)
      }
    })

    return () => authListener.subscription.unsubscribe()
  }, [selectedSport])

  useEffect(() => {
    const t = setInterval(() => updateTimeRemaining(), 1000)
    return () => clearInterval(t)
  }, [currentContest, games])

  useEffect(() => {
    const scoreInterval = setInterval(() => {
      if (games.some(g => g.status === 'in_progress')) loadContestData()
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

      if (error && (error as any).code === 'PGRST116') {
        const { error: createError } = await supabase.rpc('create_profile_for_user', { user_id: userId })
        if (!createError) {
          const { data: newUserData } = await supabase
            .from('user_profiles')
            .select('token_balance')
            .eq('id', userId)
            .single()
          if (newUserData) setTokenBalance(newUserData.token_balance)
        }
      } else if (userData) {
        setTokenBalance(userData.token_balance)
      }
    } catch (e) {
      console.error('Error loading user profile:', e)
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
    try {
      const { data: contestData } = await supabase
        .from('contests')
        .select('*')
        .eq('sport', selectedSport)
        .in('status', ['open','locked','in_progress'])
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
          if (picksData) setPicks(picksData)
        }
      }

      if (selectedSport === 'NFL') {
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, sport, team_name, city, abbreviation, primary_color, secondary_color, logo_url, pixelated_logo_url')
          .eq('sport', 'NFL')
        setTeams(teamsData || [])
      } else {
        setTeams([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const updateTimeRemaining = () => {
    if (!currentContest) return
    const now = new Date()
    const openTime = new Date(currentContest.open_time)

    if (now < openTime) {
      setContestStatus('pre-contest')
      const diff = openTime.getTime() - now.getTime()
      const h = Math.floor(diff / (1000*60*60))
      const m = Math.floor((diff % (1000*60*60)) / (1000*60))
      setTimeRemaining(`${h}h ${m}m`)
      return
    }

    const upcoming = games.filter(g => g.status === 'scheduled' && new Date(g.scheduled_time) > now)
    if (upcoming.length <= 4) {
      setContestStatus('locked')
      setTimeRemaining('LOCKED')
      return
    }
    setContestStatus('active')
    const fifthToLast = upcoming[upcoming.length - 5]
    const lockTime = new Date(fifthToLast.scheduled_time)
    const diff = lockTime.getTime() - now.getTime()
    if (diff <= 0) {
      setContestStatus('locked')
      setTimeRemaining('LOCKED')
    } else {
      const h = Math.floor(diff / (1000*60*60))
      const m = Math.floor((diff % (1000*60*60)) / (1000*60))
      setTimeRemaining(`${h}h ${m}m`)
    }
  }

  const isGameAvailable = (g: Game) =>
    g.status === 'scheduled' && new Date(g.scheduled_time) > new Date()

  // Tap again to unselect; tap opposite side replaces
  const handlePickSelect = (
    gameId: number,
    pickType: 'spread' | 'total',
    selection: 'home' | 'away' | 'over' | 'under',
    displayText: string,
    pickId: number
  ) => {
    if (!user) { setShowAuthModal(true); return }
    if (isSubmitted || gamesWithTokens.has(gameId) || contestStatus !== 'active') return

    const idxExact = selectedPicks.findIndex(p =>
      p.gameId === gameId && p.pickType === pickType && p.pickId === pickId
    )
    if (idxExact !== -1) {
      const cp = [...selectedPicks]
      cp.splice(idxExact, 1)
      setSelectedPicks(cp)
      return
    }

    const idxSameType = selectedPicks.findIndex(p =>
      p.gameId === gameId && p.pickType === pickType
    )
    if (idxSameType !== -1) {
      const cp = [...selectedPicks]
      cp[idxSameType] = { gameId, pickId, pickType, selection, displayText }
      setSelectedPicks(cp)
      return
    }

    const picksForGame = selectedPicks.filter(p => p.gameId === gameId)
    if (selectedPicks.length + gamesWithTokens.size >= 10) return
    if (picksForGame.length >= 2) return
    setSelectedPicks([...selectedPicks, { gameId, pickId, pickType, selection, displayText }])
  }

  const handleTokenToggle = (gameId: number) => {
    if (isSubmitted || contestStatus !== 'active') return
    const next = new Set(gamesWithTokens)
    if (next.has(gameId)) {
      next.delete(gameId)
      setGamesWithTokens(next)
    } else {
      if (selectedPicks.length + next.size >= 10) return
      if (gamesWithTokens.size >= 5) return
      setSelectedPicks(selectedPicks.filter(p => p.gameId !== gameId))
      next.add(gameId)
      setGamesWithTokens(next)
    }
  }

  const removePick = (index: number) =>
    setSelectedPicks(selectedPicks.filter((_, i) => i !== index))

  const submitSlate = async () => {
    if (!user || !currentContest) return
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-picks`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token ?? ''}` },
        body: JSON.stringify({
          contestId: currentContest.id,
          picks: selectedPicks.map(p => p.pickId),
          tokensUsed: gamesWithTokens.size
        })
      })
      const result = await res.json()
      if (result.success) {
        setIsSubmitted(true)
        setShowConfirmModal(false)
        setShowSlateModal(false)
        setShowSuccessModal(true)
        checkUser()
      } else {
        alert(result.error || 'Submission failed')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to submit picks. Please try again.')
    }
  }

  /* ------------ Game Card ------------ */
  const GameCard = ({ game }: { game: Game }) => {
    const gamePicks = picks.filter(p => p.game_id === game.id)
    const spreads = gamePicks.filter(p => p.pick_type === 'spread')
    const totals  = gamePicks.filter(p => p.pick_type === 'total')

    const homeSpread = spreads.find(p => p.selection === 'home')
    const awaySpread = spreads.find(p => p.selection === 'away')
    const overTotal  = totals.find(p => p.selection === 'over')
    const underTotal = totals.find(p => p.selection === 'under')

    const hasToken = gamesWithTokens.has(game.id)
    const available = isGameAvailable(game)
    const disabled  = hasToken || isSubmitted || !available || contestStatus !== 'active'
    const started   = game.status === 'in_progress' || game.status === 'final'

    const homeTeam =
      resolveTeam(game.home_team) ||
      resolveTeam(game.home_team_short)

    const awayTeam =
      resolveTeam(game.away_team) ||
      resolveTeam(game.away_team_short)

    const totalSpread = (homeSpread?.times_selected || 0) + (awaySpread?.times_selected || 0)
    const totalTotal  = (overTotal?.times_selected || 0)  + (underTotal?.times_selected || 0)
    const homeSpreadPct = totalSpread > 0 ? Math.round(((homeSpread?.times_selected || 0)/totalSpread)*100) : 50
    const awaySpreadPct = totalSpread > 0 ? Math.round(((awaySpread?.times_selected || 0)/totalSpread)*100) : 50
    const overPct       = totalTotal  > 0 ? Math.round(((overTotal?.times_selected  || 0)/totalTotal )*100) : 50
    const underPct      = totalTotal  > 0 ? Math.round(((underTotal?.times_selected || 0)/totalTotal )*100) : 50

    const homeSpreadDisplay = applyNoTieLogic(game.home_spread)
    const awaySpreadDisplay = applyNoTieLogic(game.away_spread)
    const totalDisplay      = applyNoTieLogic(game.total_points)

    const mostPopularSpread = homeSpreadPct >= awaySpreadPct
      ? { text: `${(homeTeam?.abbreviation || game.home_team_short || getCityName(game.home_team))} ${homeSpreadDisplay > 0 ? '+' : ''}${homeSpreadDisplay}`, pct: homeSpreadPct }
      : { text: `${(awayTeam?.abbreviation || game.away_team_short || getCityName(game.away_team))} ${awaySpreadDisplay > 0 ? '+' : ''}${awaySpreadDisplay}`, pct: awaySpreadPct }

    const mostPopularTotal = overPct >= underPct
      ? { text: `Over ${totalDisplay}`, pct: overPct }
      : { text: `Under ${totalDisplay}`, pct: underPct }

    const awayLabel = isMobile
      ? (awayTeam?.abbreviation || game.away_team_short || getCityName(game.away_team))
      : (awayTeam?.city || getCityName(game.away_team))
    const homeLabel = isMobile
      ? (homeTeam?.abbreviation || game.home_team_short || getCityName(game.home_team))
      : (homeTeam?.city || getCityName(game.home_team))

    const leftColor  = awayTeam?.primary_color || '#666'
    const rightColor = homeTeam?.primary_color || '#999'

    const awayLogo = awayTeam?.pixelated_logo_url || awayTeam?.logo_url
    const homeLogo = homeTeam?.pixelated_logo_url || homeTeam?.logo_url

    return (
      <div
        className={`relative rounded-2xl overflow-hidden shadow-lg border-4 ${
          hasToken ? 'border-yellow-400 bg-yellow-50' :
          !available ? 'border-gray-400 bg-gray-50' : 'border-gray-200'
        } hover:shadow-xl transition-all duration-300`}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${leftColor} 0%, ${leftColor} 45%, ${rightColor} 55%, ${rightColor} 100%)`,
            opacity: 0.08
          }}
        />
        <div className="relative bg-white/95 backdrop-blur p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-gray-700">
                <Clock className="w-4 h-4" />
                <span className="text-xs pixel-font font-bold">
                  {new Date(game.scheduled_time).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
                  })} ET
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {available && contestStatus === 'active' ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[11px] pixel-font text-green-600 font-bold">OPEN</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-[11px] pixel-font text-red-600 font-bold">CLOSED</span>
                  </>
                )}
              </div>
            </div>

            {available && contestStatus === 'active' && (
              <button
                onClick={() => handleTokenToggle(game.id)}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs pixel-font transition-all ${
                  hasToken ? 'bg-yellow-400 text-yellow-900 shadow-md' : 'bg-gray-100 hover:bg-yellow-100 text-gray-700'
                }`}
              >
                <TokenIcon className="w-4 h-4" />
                <span>{hasToken ? 'TOKEN USED' : 'USE TOKEN'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-center mb-3">
            <div className="flex items-center gap-2 flex-1 justify-end">
              {awayLogo && (
                <img
                  src={awayLogo}
                  alt={awayTeam?.team_name || 'Away'}
                  className="w-8 h-8"
                  style={{ imageRendering: 'pixelated' }}
                />
              )}
              <span className="text-sm font-bold pixel-font" style={{ color: leftColor }}>
                {awayLabel}
              </span>
            </div>
            <span className="mx-3 text-gray-500 text-sm pixel-font">@</span>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm font-bold pixel-font" style={{ color: rightColor }}>
                {homeLabel}
              </span>
              {homeLogo && (
                <img
                  src={homeLogo}
                  alt={homeTeam?.team_name || 'Home'}
                  className="w-8 h-8"
                  style={{ imageRendering: 'pixelated' }}
                />
              )}
            </div>
          </div>

          {(game.status === 'in_progress' || game.status === 'final') && (
            <div className="text-center mb-3">
              <div className="text-xl font-bold pixel-font">
                <span className={(game.away_score || 0) > (game.home_score || 0) ? 'text-green-600' : 'text-gray-700'}>
                  {game.away_score ?? 0}
                </span>
                <span className="text-gray-500 mx-3">-</span>
                <span className={(game.home_score || 0) > (game.away_score || 0) ? 'text-green-600' : 'text-gray-700'}>
                  {game.home_score ?? 0}
                </span>
              </div>
              {game.status === 'in_progress' && (
                <span className="text-[11px] pixel-font text-red-600 animate-pulse">LIVE</span>
              )}
              {game.status === 'final' && (
                <span className="text-[11px] pixel-font text-gray-600">FINAL</span>
              )}
            </div>
          )}

          {isGameAvailable(game) ? (
            <div className="space-y-3">
              <div>
                <div className="text-center text-[11px] font-bold text-gray-500 mb-1 pixel-font">SPREAD</div>
                <div className="grid grid-cols-2 gap-2">
                  <PickButton
                    text={`${awayTeam?.abbreviation || game.away_team_short || getCityName(game.away_team)} ${awaySpreadDisplay > 0 ? '+' : ''}${awaySpreadDisplay}`}
                    isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'spread' && p.pickId === (awaySpread?.id ?? -1))}
                    onClick={() => awaySpread && handlePickSelect(
                      game.id, 'spread', 'away',
                      `${awayTeam?.abbreviation || game.away_team_short || getCityName(game.away_team)} ${awaySpreadDisplay > 0 ? '+' : ''}${awaySpreadDisplay}`,
                      awaySpread.id
                    )}
                    disabled={disabled || !awaySpread}
                    percentage={awaySpreadPct}
                  />
                  <PickButton
                    text={`${homeTeam?.abbreviation || game.home_team_short || getCityName(game.home_team)} ${homeSpreadDisplay > 0 ? '+' : ''}${homeSpreadDisplay}`}
                    isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'spread' && p.pickId === (homeSpread?.id ?? -1))}
                    onClick={() => homeSpread && handlePickSelect(
                      game.id, 'spread', 'home',
                      `${homeTeam?.abbreviation || game.home_team_short || getCityName(game.home_team)} ${homeSpreadDisplay > 0 ? '+' : ''}${homeSpreadDisplay}`,
                      homeSpread.id
                    )}
                    disabled={disabled || !homeSpread}
                    percentage={homeSpreadPct}
                  />
                </div>
              </div>

              <div>
                <div className="text-center text-[11px] font-bold text-gray-500 mb-1 pixel-font">
                  {game.sport === 'MLB' ? 'TOTAL RUNS' : 'TOTAL POINTS'}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PickButton
                    text={`Over ${totalDisplay}`}
                    isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'total' && p.pickId === (overTotal?.id ?? -1))}
                    onClick={() => overTotal && handlePickSelect(
                      game.id, 'total', 'over',
                      `Over ${totalDisplay}`,
                      overTotal.id
                    )}
                    disabled={disabled || !overTotal}
                    percentage={overPct}
                  />
                  <PickButton
                    text={`Under ${totalDisplay}`}
                    isSelected={selectedPicks.some(p => p.gameId === game.id && p.pickType === 'total' && p.pickId === (underTotal?.id ?? -1))}
                    onClick={() => underTotal && handlePickSelect(
                      game.id, 'total', 'under',
                      `Under ${totalDisplay}`,
                      underTotal.id
                    )}
                    disabled={disabled || !underTotal}
                    percentage={underPct}
                  />
                </div>
              </div>
            </div>
          ) : (
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

          {hasToken && (
            <div className="mt-3 text-center">
              <span className="text-[11px] text-yellow-700 pixel-font animate-pulse">
                TOKEN APPLIED - NO PICKS NEEDED
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const PickButton = ({
    text, isSelected, onClick, disabled, percentage
  }: {
    text: string
    isSelected: boolean
    onClick: () => void
    disabled: boolean
    percentage?: number
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative px-3 py-2 rounded-lg pixel-font text-xs font-bold transition-all duration-200 overflow-hidden
        ${isSelected 
          ? 'bg-yellow-400 border-2 border-yellow-600 text-yellow-900 shadow-lg' 
          : disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-gray-100 hover:bg-blue-100 text-gray-700 hover:shadow-md'
        }
      `}
    >
      {typeof percentage === 'number' && (
        <div className="absolute left-0 top-0 bottom-0 bg-black opacity-10" style={{ width: `${percentage}%` }} />
      )}
      <span className="relative z-10 flex items-center justify-center gap-1">
        {isSelected && <Zap className="w-3 h-3" />}
        <span className="truncate">{text}</span>
        {typeof percentage === 'number' && (
          <span className="text-[10px] opacity-75">({percentage}%)</span>
        )}
      </span>
    </button>
  )

  /* ------------ Loading ------------ */
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
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="min-h-screen relative">
      <style jsx>{`
        @keyframes Drift {
          from { transform: translateX(-200px); }
          to   { transform: translateX(calc(100vw + 200px)); }
        }
      `}</style>

      {/* Sky */}
      <div className="bg-sky-400 absolute top-0 left-0 right-0 h-[450px]" />

      {/* Pixel clouds from Storage */}
      <div className="absolute top-0 left-0 right-0 h-[450px] overflow-hidden pointer-events-none" style={{ zIndex: 5 }}>
        {(() => {
          const seed = Number(new Date().toISOString().slice(0,10).replace(/-/g,'')) // stable per day
          const howMany = isMobile ? 6 : 8
          const chosen = pickIndices(seed, howMany)
          return chosen.map((idx, k) => (
            <img
              key={k}
              src={Url(idx)}
              alt=""
              role="presentation"
              className="absolute select-none"
              style={{
                top: `${12 + (k * 9) % 55}%`,
                height: `${36 + (k % 4) * 10}px`,
                animation: `Drift ${24 + (k % 6) * 4}s linear infinite`,
                animationDelay: `${k * 1.6}s`,
                opacity: 0.24 + (k % 4) * 0.06,
                transform: 'translateX(0)'
              }}
            />
          ))
        })()}
      </div>

      {/* Field */}
      <div className="bg-green-500 absolute top-[450px] left-0 right-0 bottom-0" />

      {/* Nav */}
      <nav className="relative z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="relative">
              <button
                onClick={() => setShowSportDropdown(s => !s)}
                className="flex items-center gap-2 text-white pixel-font text-sm md:text-base hover:text-yellow-300 transition-colors"
              >
                <span>PERFECT SLATE {selectedSport}</span>
                <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              {showSportDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl overflow-hidden z-50">
                  {(['NFL','NCAAF','MLB'] as Sport[]).map(s => (
                    <button
                      key={s}
                      onClick={() => { setSelectedSport(s); setShowSportDropdown(false) }}
                      className="block w-full text-left px-5 py-3 pixel-font text-xs md:text-sm hover:bg-blue-50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden md:flex items-center gap-5">
              <button className="text-white pixel-font text-sm hover:text-yellow-300 transition-colors flex items-center gap-2">
                <FileText className="w-4 h-4" /><span>RULES</span>
              </button>
              <button className="text-white pixel-font text-sm hover:text-yellow-300 transition-colors flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /><span>LEADERBOARDS</span>
              </button>
              {user ? (
                <button onClick={() => router.push('/profile')} className="text-white pixel-font text-sm hover:text-yellow-300 transition-colors flex items-center gap-2">
                  <User className="w-4 h-4" /><span>PROFILE</span>
                </button>
              ) : (
                <button
                  onClick={() => { setAuthMode('signup'); setShowAuthModal(true) }}
                  className="bg-yellow-400 text-yellow-900 pixel-font text-sm hover:bg-yellow-300 transition-colors flex items-center gap-2 px-4 py-2 rounded-lg font-bold"
                >
                  <Zap className="w-4 h-4" /><span>SIGN UP</span>
                </button>
              )}
            </div>

            <button onClick={() => setShowMobileMenu(m => !m)} className="md:hidden text-white">
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {showMobileMenu && (
            <div className="md:hidden mt-3 pb-3 border-t border-blue-300 pt-3">
              <button className="block w-full text-left text-white pixel-font text-sm py-2 hover:text-yellow-300 transition-colors">RULES</button>
              <button className="block w-full text-left text-white pixel-font text-sm py-2 hover:text-yellow-300 transition-colors">LEADERBOARDS</button>
              {user ? (
                <button onClick={() => { router.push('/profile'); setShowMobileMenu(false) }} className="block w-full text-left text-white pixel-font text-sm py-2 hover:text-yellow-300 transition-colors">PROFILE</button>
              ) : (
                <button onClick={() => { setAuthMode('signup'); setShowAuthModal(true); setShowMobileMenu(false) }} className="block w-full text-left text-yellow-300 pixel-font text-sm py-2 hover:text-yellow-400 transition-colors font-bold">SIGN UP TO PLAY</button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Header */}
      <div className="relative z-10 pb-12">
        <div className="text-center pt-6">
          <button onClick={() => setShowPrizeHistory(true)} className="inline-block mb-4 group">
            <div className="bg-yellow-400 rounded-xl px-5 md:px-6 py-3 md:py-3.5 shadow-xl transform group-hover:scale-105 transition-all duration-300">
              <div className="flex items-center gap-2">
                <Coins className="w-6 h-6 md:w-7 md:h-7 text-yellow-700" />
                <span className="text-xl md:text-2xl font-bold pixel-font text-yellow-900">
                  ${currentContest?.final_prize_pool.toLocaleString() || '0'}
                </span>
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-yellow-700" />
              </div>
            </div>
          </button>

          <div className="flex justify-center items-center gap-6 md:gap-8 text-white mb-6">
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Users className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-lg md:text-xl font-bold pixel-font">{currentContest?.total_entries || 0}</span>
              </div>
              <div className="text-[11px] pixel-font opacity-90">ENTRIES</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-lg md:text-xl font-bold pixel-font">{timeRemaining}</span>
              </div>
              <div className="text-[11px] pixel-font opacity-90">
                {contestStatus === 'pre-contest' ? 'OPENS IN' : contestStatus === 'active' ? 'CLOSES IN' : 'CONTEST LOCKED'}
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-white/90 backdrop-blur rounded-xl p-3 md:p-4 shadow-xl border-4 border-yellow-400">
              <h2 className="text-base md:text-lg font-bold pixel-font text-gray-800 mb-1">SELECT YOUR PERFECT 10</h2>
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-sm md:text-base pixel-font">{today}</span>
              </div>
              {contestStatus === 'pre-contest' && (
                <div className="mt-2 text-xs pixel-font text-orange-600">Contest opens at 7:00 AM ET</div>
              )}
              {contestStatus === 'locked' && (
                <div className="mt-2 text-xs pixel-font text-red-600">Contest is locked - games in progress</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Games */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pb-24 -mt-8">
        <div className="space-y-3">
          {games.map(g => <GameCard key={g.id} game={g} />)}
        </div>
      </div>

      {/* Floating picks */}
      {totalPicks > 0 && !isSubmitted && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => setShowSlateModal(true)}
            className={`${totalPicks === 10 ? 'bg-green-400' : 'bg-yellow-400'} rounded-full shadow-xl p-4 hover:scale-110 transition-all duration-300 ${totalPicks === 10 ? 'animate-pulse' : ''}`}
          >
            <div className="text-center">
              <div className="text-xl md:text-2xl font-bold pixel-font text-gray-800">{totalPicks}</div>
              <div className="text-[11px] pixel-font text-gray-600">PICKS</div>
            </div>
            {totalPicks === 10 && (
              <div className="absolute -top-2 -right-2 animate-bounce">
                <div className="bg-green-400 rounded-full p-2"><Trophy className="w-4 h-4 text-white" /></div>
              </div>
            )}
          </button>
          {totalPicks === 10 && (
            <div className="absolute -top-14 right-0 bg-green-500 rounded-lg px-3 py-1 shadow-lg animate-pulse">
              <span className="text-[11px] pixel-font text-white font-bold">READY!</span>
            </div>
          )}
        </div>
      )}

      {/* Slate modal */}
      {showSlateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 md:p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base md:text-lg font-bold pixel-font">YOUR SLATE ({totalPicks}/10)</h3>
              <button onClick={() => setShowSlateModal(false)}><X className="w-5 h-5" /></button>
            </div>

            {user && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold pixel-font">TOKEN BALANCE:</span>
                  <span className="text-base font-bold pixel-font text-yellow-700">{tokenBalance}</span>
                </div>
                <div className="text-[11px] pixel-font mt-1 text-gray-600">
                  Using {gamesWithTokens.size} token{gamesWithTokens.size !== 1 ? 's' : ''} this slate
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {selectedPicks.map((pick, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-xs font-bold pixel-font">{pick.displayText}</span>
                  <button onClick={() => removePick(index)}>
                    <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                  </button>
                </div>
              ))}

              {Array.from(gamesWithTokens).map(gameId => {
                const g = games.find(x => x.id === gameId)
                if (!g) return null
                const ht = resolveTeam(g.home_team) || resolveTeam(g.home_team_short)
                const at = resolveTeam(g.away_team) || resolveTeam(g.away_team_short)
                const left = at?.abbreviation || g.away_team_short || getCityName(g.away_team)
                const right = ht?.abbreviation || g.home_team_short || getCityName(g.home_team)
                return (
                  <div key={`token-${gameId}`} className="bg-yellow-50 rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <TokenIcon className="w-4 h-4 text-yellow-600" />
                      <span className="text-xs font-bold pixel-font">TOKEN: {left} @ {right}</span>
                    </div>
                    <button onClick={() => handleTokenToggle(gameId)}>
                      <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
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

      {/* Confirm modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 md:p-6 max-w-sm w-full">
            <div className="text-center">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
              <h3 className="text-base font-bold pixel-font mb-3">LOCK IT IN?</h3>
              <p className="text-xs pixel-font text-gray-700 mb-4">This slate is FINAL! No changes allowed!</p>
              <div className="flex gap-2">
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

      {/* Success modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 md:p-6">
            <div className="text-center">
              <div className="mb-3 animate-bounce">
                <Trophy className="w-12 h-12 mx-auto text-yellow-500" />
              </div>
              <h3 className="text-lg font-bold pixel-font mb-2">SLATE LOCKED!</h3>
              <p className="text-xs pixel-font text-gray-700 mb-3">Good luck! Check back after games end.</p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-white font-bold pixel-font text-xs transition-colors"
              >
                LET&apos;S GO!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl border-4 border-gray-800 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 z-10">
              <X className="w-5 h-5" />
            </button>

            <div className="relative bg-gradient-to-b from-green-500 to-green-600 p-6 text-center">
              <div className="flex justify-center mb-3"><Zap className="w-10 h-10 text-yellow-300" /></div>
              <h2 className="text-xl font-bold text-white pixel-font mb-2">SIGN UP TO PLAY</h2>
              <p className="text-yellow-300 text-xs pixel-font mb-1">Win real cash prizes daily</p>
              <p className="text-white text-xs pixel-font opacity-90">100% FREE to play</p>
            </div>

            <div className="p-4">
              <AuthForm
                mode={authMode}
                onModeChange={setAuthMode}
                onSuccess={() => { setShowAuthModal(false); checkUser(); loadContestData() }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Verification */}
      {showVerificationSuccess && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border-4 border-green-500 relative overflow-hidden">
            <div className="relative bg-gradient-to-b from-green-500 to-green-600 p-8 text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white pixel-font mb-3">EMAIL VERIFIED!</h2>
              <p className="text-white text-sm pixel-font mb-2">Your email has been confirmed!</p>
              <p className="text-yellow-300 text-sm pixel-font">{user ? 'You can now play Perfect Slate' : 'Please sign in to start playing'}</p>
            </div>

            <div className="p-6 text-center">
              <p className="text-gray-600 text-sm pixel-font mb-6 italic">"Good luck out there, champ! 🏆"</p>
              {user ? (
                <button
                  onClick={() => setShowVerificationSuccess(false)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-lg pixel-font text-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-3"
                >
                  <Trophy className="w-6 h-6" /><span>PLAY NOW!</span><ArrowRight className="w-6 h-6" />
                </button>
              ) : (
                <button
                  onClick={() => { setShowVerificationSuccess(false); setShowAuthModal(true); setAuthMode('signin') }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-lg pixel-font text-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-3"
                >
                  <LogOut className="w-6 h-6" /><span>SIGN IN TO PLAY</span><ArrowRight className="w-6 h-6" />
                </button>
              )}
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 pixel-font">
                <Zap className="w-4 h-4 text-yellow-500" /><span>You've earned your first free token!</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
