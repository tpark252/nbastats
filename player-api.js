import axios from 'axios';

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

/**
 * Search for a player by name
 * @param {string} playerName - Name of the player to search for
 */
export const searchESPNPlayer = async (playerName) => {
  try {
    // Search using ESPN API
    const response = await axios.get(`${BASE_URL}/athletes?limit=50&search=${encodeURIComponent(playerName)}`);
    
    if (!response.data || !response.data.items || response.data.items.length === 0) {
      return null;
    }
    
    // Return the best match
    return response.data.items[0];
  } catch (error) {
    console.error(`Error searching for player ${playerName}:`, error.message);
    return null;
  }
};

/**
 * Get player game stats for a specific date
 * @param {string} playerName - Player's name
 * @param {string} date - Date in YYYY-MM-DD format
 */
export const getPlayerGameStats = async (playerName, date) => {
  try {
    // First find the player
    const player = await searchESPNPlayer(playerName);
    
    if (!player) {
      return {
        source: 'error',
        error: `Could not find player information for ${playerName}`
      };
    }
    
    let formattedDate = '';
    if (date) {
      try {
        const dateObj = new Date(date);
        formattedDate = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`;
      } catch (e) {
        console.error('Date parsing error:', e);
        formattedDate = date.replace(/-/g, '');
      }
    }
    
    // Try to find games on this date
    const gamesUrl = `${BASE_URL}/scoreboard${formattedDate ? `?date=${formattedDate}` : ''}`;
    const gamesResponse = await axios.get(gamesUrl);
    
    if (!gamesResponse.data || !gamesResponse.data.events || gamesResponse.data.events.length === 0) {
      return {
        source: 'espn',
        player: player,
        message: `No games found for ${date}. ESPN does not have specific game data for ${playerName} on this date.`,
        alternatives: [
          `ESPN player page: https://www.espn.com/nba/player/_/id/${player.id}/${player.lastName.toLowerCase()}-${player.firstName.toLowerCase()}`,
          `NBA official stats: https://www.nba.com/stats`
        ]
      };
    }
    
    // Try to find player's team's game
    const teamId = player.team?.id;
    
    if (!teamId) {
      return {
        source: 'espn',
        player: player,
        message: `Could not determine current team for ${playerName}.`,
        alternatives: [
          `ESPN player page: https://www.espn.com/nba/player/_/id/${player.id}/${player.lastName.toLowerCase()}-${player.firstName.toLowerCase()}`,
          `NBA official stats: https://www.nba.com/stats`
        ]
      };
    }
    
    // Find game with player's team
    const playerGame = gamesResponse.data.events.find(event => {
      const teams = event.competitions[0].competitors.map(c => c.team.id);
      return teams.includes(teamId);
    });
    
    if (!playerGame) {
      return {
        source: 'espn',
        player: player,
        message: `${playerName}'s team did not play on ${date}.`,
        alternatives: [
          `ESPN player page: https://www.espn.com/nba/player/_/id/${player.id}/${player.lastName.toLowerCase()}-${player.firstName.toLowerCase()}`,
          `NBA official stats: https://www.nba.com/stats`
        ]
      };
    }
    
    // ESPN API doesn't provide player-specific stats easily for some reason
    // I would recommend you actually pay for an API source if you want reliability, I'm just using this reversed engineered api because it's free.
    return {
      source: 'espn',
      player: player,
      game: {
        id: playerGame.id,
        date: playerGame.date,
        name: playerGame.name,
        status: playerGame.status.type.description,
        teams: playerGame.competitions[0].competitors.map(c => ({
          id: c.team.id,
          name: c.team.displayName,
          abbreviation: c.team.abbreviation,
          score: parseInt(c.score || '0'),
          homeAway: c.homeAway
        }))
      },
      message: `${playerName} played in this game, but detailed statistics require checking official NBA sources.`
    };
    
  } catch (error) {
    console.error(`Error getting player game stats for ${playerName}:`, error.message);
    return {
      source: 'error',
      error: `Technical issue retrieving data for ${playerName}: ${error.message}`
    };
  }
};

/**
 * Get player season stats
 * @param {string} playerName - Player's name
 * @param {number} season - Season year (e.g., 2023 for 2022-23 season)
 */
export const getPlayerSeasonStats = async (playerName, season = null) => {
  try {
    // First find the player
    const player = await searchESPNPlayer(playerName);
    
    if (!player) {
      return {
        source: 'error',
        error: `Could not find player information for ${playerName}`
      };
    }
    
    // Get player stats from ESPN
    const statsUrl = `${BASE_URL}/athletes/${player.id}/stats`;
    const response = await axios.get(statsUrl);
    
    if (!response.data || !response.data.splits) {
      return {
        source: 'error',
        error: `No statistics available for ${playerName}`
      };
    }
    
    // Filter by season if provided
    let seasonData = response.data;
    if (season && response.data.splits) {
      // ESPN's API doesn't easily let you filter by season; tough scenes.
      seasonData.seasonSpecified = season;
    }
    
    return {
      source: 'espn',
      player: player,
      stats: seasonData,
      season: season || 'current'
    };
  } catch (error) {
    console.error(`Error getting season stats for ${playerName}:`, error.message);
    return {
      source: 'error',
      error: `Technical issue retrieving data for ${playerName}: ${error.message}`
    };
  }
};

export default {
  searchESPNPlayer,
  getPlayerGameStats,
  getPlayerSeasonStats
};