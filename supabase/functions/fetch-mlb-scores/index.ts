// supabase/functions/fetch-mlb-scores/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const oddsApiKey = Deno.env.get('ODDS_API_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting MLB scores update...')

    // Get all games that need score updates (scheduled or in_progress)
    const { data: gamesToUpdate, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'MLB')
      .in('status', ['scheduled', 'in_progress'])
      .gte('scheduled_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    
    if (gamesError) {
      throw new Error(`Failed to fetch games: ${gamesError.message}`)
    }

    console.log(`Found ${gamesToUpdate?.length || 0} games to check`)

    if (!gamesToUpdate || gamesToUpdate.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No games to update',
          gamesChecked: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch scores from The Odds API
    const sport = 'baseball_mlb'
    const daysFrom = 1 // Look back 1 day for recent games
    const scoresUrl = `https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${oddsApiKey}&daysFrom=${daysFrom}`
    
    console.log('Fetching scores from Odds API...')
    const scoresResponse = await fetch(scoresUrl)
    
    if (!scoresResponse.ok) {
      throw new Error(`Odds API error: ${scoresResponse.status} - ${scoresResponse.statusText}`)
    }
    
    const scoresData = await scoresResponse.json()
    console.log(`Received ${scoresData.length} game scores from API`)
    
    // Create a map for quick lookup
    const scoresMap = new Map()
    scoresData.forEach((game: any) => {
      scoresMap.set(game.id, game)
    })
    
    // Track updates
    let gamesUpdated = 0
    let gamesCompleted = 0
    let gamesInProgress = 0
    
    // Update each game
    for (const game of gamesToUpdate) {
      if (!game.external_id) {
        console.log(`Game ${game.id} has no external_id, skipping`)
        continue
      }
      
      const scoreData = scoresMap.get(game.external_id)
      
      if (!scoreData) {
        console.log(`No score data for game ${game.id} (${game.away_team} @ ${game.home_team})`)
        continue
      }
      
      // Determine game status and scores
      let newStatus = game.status
      let homeScore = null
      let awayScore = null
      
      if (scoreData.completed) {
        // Game is complete
        newStatus = 'completed'
        homeScore = scoreData.scores?.find((s: any) => s.name === game.home_team)?.score || 0
        awayScore = scoreData.scores?.find((s: any) => s.name === game.away_team)?.score || 0
        gamesCompleted++
        
        console.log(`Game COMPLETED: ${game.away_team} ${awayScore} @ ${game.home_team} ${homeScore}`)
      } else if (scoreData.scores && scoreData.scores.length > 0) {
        // Game is in progress
        newStatus = 'in_progress'
        homeScore = scoreData.scores?.find((s: any) => s.name === game.home_team)?.score || 0
        awayScore = scoreData.scores?.find((s: any) => s.name === game.away_team)?.score || 0
        gamesInProgress++
        
        console.log(`Game IN PROGRESS: ${game.away_team} ${awayScore} @ ${game.home_team} ${homeScore}`)
      }
      
      // Update game if status or scores changed
      if (newStatus !== game.status || homeScore !== game.home_score || awayScore !== game.away_score) {
        const { error: updateError } = await supabase
          .from('games')
          .update({
            status: newStatus,
            home_score: homeScore,
            away_score: awayScore,
            updated_at: new Date().toISOString()
          })
          .eq('id', game.id)
        
        if (updateError) {
          console.error(`Failed to update game ${game.id}:`, updateError)
          continue
        }
        
        gamesUpdated++
        
        // If game just completed, trigger pick grading
        if (newStatus === 'completed' && game.status !== 'completed') {
          console.log(`Grading picks for completed game ${game.id}`)
          
          // Call the grade_game_picks function
          const { error: gradeError } = await supabase.rpc('grade_game_picks', {
            game_id_param: game.id
          })
          
          if (gradeError) {
            console.error(`Failed to grade picks for game ${game.id}:`, gradeError)
          } else {
            console.log(`Successfully graded picks for game ${game.id}`)
          }
        }
      }
    }
    
    // After updating all games, check if any contests need finalizing
    if (gamesCompleted > 0) {
      console.log('Checking for contests to finalize...')
      const { error: finalizeError } = await supabase.rpc('finalize_mlb_contests')
      
      if (finalizeError) {
        console.error('Failed to finalize contests:', finalizeError)
      } else {
        console.log('Contest finalization check complete')
      }
    }
    
    // Also check if any contests need to be locked
    console.log('Checking for contests to lock...')
    const { error: lockError } = await supabase.rpc('check_and_lock_mlb_contests')
    
    if (lockError) {
      console.error('Failed to check contest locks:', lockError)
    }
    
    const summary = {
      success: true,
      gamesChecked: gamesToUpdate.length,
      gamesUpdated,
      gamesCompleted,
      gamesInProgress,
      remainingQuota: scoresResponse.headers.get('x-requests-remaining'),
      timestamp: new Date().toISOString()
    }
    
    console.log('Score update complete:', summary)
    
    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error in fetch-mlb-scores:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
// Deploy test
