import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions for our database
export type Contest = {
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

export type Pick = {
  id: number
  game_id: number
  pick_type: 'spread' | 'total'
  selection: 'home' | 'away' | 'over' | 'under'
  line_value: number
  times_selected: number
}
