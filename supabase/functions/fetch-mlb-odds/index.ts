// supabase/functions/fetch-mlb-odds/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const oddsApiKey = Deno.env.get('ODDS_API_KEY')!;
    
    // DEBUG: Log API key info
    console.log('=== API KEY DEBUG ===');
    console.log('API Key exists:', !!oddsApiKey);
    console.log('API Key length:', oddsApiKey?.length || 0);
    console.log('First 4 chars:', oddsApiKey ? oddsApiKey.substring(0, 4) + '...' : 'NO KEY');
    console.log('Last 4 chars:', oddsApiKey ? '...' + oddsApiKey.substring(oddsApiKey.length - 4) : 'NO KEY');
    console.log('===================');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch current MLB odds from The Odds API
    const sport = 'baseball_mlb';
    const regions = 'us'; // US bookmakers
    const markets = 'spreads,totals';
    const oddsFormat = 'american';
    const dateFormat = 'iso';
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${oddsApiKey}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}&dateFormat=${dateFormat}`;
    
    // DEBUG: Log the URL (without the full API key)
    console.log('Fetching MLB odds...');
    console.log('URL:', oddsUrl.replace(oddsApiKey, 'HIDDEN_KEY'));
    
    const oddsResponse = await fetch(oddsUrl);
    
    // DEBUG: Log response details
    console.log('Response status:', oddsResponse.status);
    console.log('Response status text:', oddsResponse.statusText);
    
    if (!oddsResponse.ok) {
      // Try to get error details
      const errorText = await oddsResponse.text();
      console.error('Odds API error response:', errorText);
      throw new Error(`Odds API error: ${oddsResponse.status} - ${errorText}`);
    }
    
    const oddsData = await oddsResponse.json();
    console.log(`Found ${oddsData.length} MLB games`);
    
    // Get today's contest
    const today = new Date().toISOString().split('T')[0];
    const { data: contest } = await supabase
      .from('contests')
      .select('*')
      .eq('sport', 'MLB')
      .eq('status', 'open')
      .gte('lock_time', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!contest) {
      throw new Error('No open MLB contest found for today');
    }
    
    // Process each game
    let gamesProcessed = 0;
    let gamesSkipped = 0;
    
    for (const game of oddsData) {
      // Skip if game already started
      const gameTime = new Date(game.commence_time);
      const gameDate = gameTime.toISOString().split('T')[0];
      const todayDate = new Date().toISOString().split('T')[0];
      
      // Include all games from today, even if started
      if (gameDate < todayDate) {
        console.log(`Skipping ${game.away_team} @ ${game.home_team} - game from previous day`);
        gamesSkipped++;
        continue;
      }
      
      // Find the best odds from available bookmakers
      let bestSpread = null;
      let bestTotal = null;
      
      // Look through bookmakers for best lines
      for (const bookmaker of game.bookmakers) {
        for (const market of bookmaker.markets) {
          if (market.key === 'spreads' && market.outcomes.length >= 2) {
            const homeSpread = market.outcomes.find((o) => o.name === game.home_team);
            const awaySpread = market.outcomes.find((o) => o.name === game.away_team);
            
            if (homeSpread && awaySpread) {
              // Apply no-tie rule: adjust whole numbers by 0.5
              let homeSpreadValue = parseFloat(homeSpread.point);
              let awaySpreadValue = parseFloat(awaySpread.point);
              
              if (homeSpreadValue % 1 === 0) homeSpreadValue += 0.5;
              if (awaySpreadValue % 1 === 0) awaySpreadValue += 0.5;
              
              bestSpread = {
                home: homeSpreadValue,
                away: awaySpreadValue
              };
            }
          }
          
          if (market.key === 'totals' && market.outcomes.length >= 2) {
            let totalValue = parseFloat(market.outcomes[0].point);
            
            // Apply no-tie rule: adjust whole numbers by 0.5
            if (totalValue % 1 === 0) totalValue += 0.5;
            
            bestTotal = totalValue;
          }
        }
      }
      
      // Skip if we don't have both spread and total
      if (!bestSpread || !bestTotal) {
        console.log(`Skipping ${game.away_team} @ ${game.home_team} - missing lines`);
        gamesSkipped++;
        continue;
      }
      
      // Check if game already exists
      const { data: existingGame } = await supabase
        .from('games')
        .select('id')
        .eq('external_id', game.id)
        .single();
      
      if (existingGame) {
        // Update existing game
        await supabase
          .from('games')
          .update({
            home_spread: bestSpread.home,
            away_spread: bestSpread.away,
            total_points: bestTotal,
            scheduled_time: game.commence_time,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingGame.id);
        
        // Update picks
        await updatePicksForGame(supabase, existingGame.id, bestSpread, bestTotal);
      } else {
        // Insert new game
        const { data: newGame, error: gameError } = await supabase
          .from('games')
          .insert({
            external_id: game.id,
            contest_id: contest.id,
            sport: 'MLB',
            home_team: game.home_team,
            away_team: game.away_team,
            home_team_short: getTeamAbbreviation(game.home_team),
            away_team_short: getTeamAbbreviation(game.away_team),
            scheduled_time: game.commence_time,
            home_spread: bestSpread.home,
            away_spread: bestSpread.away,
            total_points: bestTotal,
            status: 'scheduled'
          })
          .select()
          .single();
        
        if (gameError) {
          console.error('Error inserting game:', gameError);
          continue;
        }
        
        // Create picks for the new game
        await createPicksForGame(supabase, newGame.id, bestSpread, bestTotal);
      }
      
      gamesProcessed++;
    }
    
    console.log(`Processed ${gamesProcessed} games, skipped ${gamesSkipped}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        gamesProcessed,
        gamesSkipped,
        remainingQuota: oddsResponse.headers.get('x-requests-remaining')
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

// Helper function to create picks for a game
async function createPicksForGame(supabase: any, gameId: number, spread: any, total: number) {
  const picks = [
    {
      game_id: gameId,
      pick_type: 'spread',
      selection: 'home',
      line_value: spread.home
    },
    {
      game_id: gameId,
      pick_type: 'spread',
      selection: 'away',
      line_value: spread.away
    },
    {
      game_id: gameId,
      pick_type: 'total',
      selection: 'over',
      line_value: total
    },
    {
      game_id: gameId,
      pick_type: 'total',
      selection: 'under',
      line_value: total
    }
  ];
  
  await supabase.from('picks').insert(picks);
}

// Helper function to update picks for existing game
async function updatePicksForGame(supabase: any, gameId: number, spread: any, total: number) {
  // Update spread picks
  await supabase
    .from('picks')
    .update({
      line_value: spread.home
    })
    .eq('game_id', gameId)
    .eq('pick_type', 'spread')
    .eq('selection', 'home');
  
  await supabase
    .from('picks')
    .update({
      line_value: spread.away
    })
    .eq('game_id', gameId)
    .eq('pick_type', 'spread')
    .eq('selection', 'away');
  
  // Update total picks
  await supabase
    .from('picks')
    .update({
      line_value: total
    })
    .eq('game_id', gameId)
    .eq('pick_type', 'total');
}

// Helper function to get team abbreviations
function getTeamAbbreviation(teamName: string): string {
  const abbreviations: Record<string, string> = {
    'Arizona Diamondbacks': 'ARI',
    'Atlanta Braves': 'ATL',
    'Baltimore Orioles': 'BAL',
    'Boston Red Sox': 'BOS',
    'Chicago Cubs': 'CHC',
    'Chicago White Sox': 'CHW',
    'Cincinnati Reds': 'CIN',
    'Cleveland Guardians': 'CLE',
    'Colorado Rockies': 'COL',
    'Detroit Tigers': 'DET',
    'Houston Astros': 'HOU',
    'Kansas City Royals': 'KC',
    'Los Angeles Angels': 'LAA',
    'Los Angeles Dodgers': 'LAD',
    'Miami Marlins': 'MIA',
    'Milwaukee Brewers': 'MIL',
    'Minnesota Twins': 'MIN',
    'New York Mets': 'NYM',
    'New York Yankees': 'NYY',
    'Oakland Athletics': 'OAK',
    'Philadelphia Phillies': 'PHI',
    'Pittsburgh Pirates': 'PIT',
    'San Diego Padres': 'SD',
    'San Francisco Giants': 'SF',
    'Seattle Mariners': 'SEA',
    'St. Louis Cardinals': 'STL',
    'Tampa Bay Rays': 'TB',
    'Texas Rangers': 'TEX',
    'Toronto Blue Jays': 'TOR',
    'Washington Nationals': 'WSH'
  };
  
  return abbreviations[teamName] || teamName.substring(0, 3).toUpperCase();
}
/
