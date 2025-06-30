import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions for our database
export type Game = {
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
  home_score?: number
  away_score?: number
  status: string
}

export type Pick = {
  id: number
  game_id: number
  pick_type: 'spread' | 'total'
  selection: 'home' | 'away' | 'over' | 'under'
  line_value: number
  times_selected: number
}

export type Contest = {
  id: number
  sport: 'NFL' | 'NCAAF'
  week_number: number
  open_time: string
  lock_time: string
  close_time: string
  final_prize_pool: number
  total_entries: number
  status: string
}

export type UserPick = {
  gameId: number
  pickId: number
  pickType: 'spread' | 'total'
  selection: string
  displayText: string
}
