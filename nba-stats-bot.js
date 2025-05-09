import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import {
  getAllTeams,
  searchPlayers,
  getRecentGames,
  getPlayerSeasonAverages,
  getTeamGames,
  getPlayerGameStats,
  getStandings,
  getTeamSchedule
} from './server-fixes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config(); 
if (!process.env.OPENAI_API_KEY) {
  dotenv.config({ path: join(__dirname, 'server', '.env') }); 
}
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class NBAStatsBot {
  constructor() {
    this.tools = [
      {
        type: "function",
        function: {
          name: "getStandings",
          description: "Get current NBA standings (league or conference)",
          parameters: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "Type of standings ('league' or 'conference')",
                enum: ["league", "conference"]
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getTeamSchedule",
          description: "Get a team's schedule and recent results",
          parameters: {
            type: "object",
            properties: {
              teamName: {
                type: "string",
                description: "Team name (e.g., 'Lakers', 'Boston Celtics')"
              }
            },
            required: ["teamName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getRecentGames",
          description: "Get recent NBA games for a specific date",
          parameters: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "Date in YYYY-MM-DD format. If not provided, will use yesterday's date."
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "searchPlayers",
          description: "Search for NBA players by name",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Player name to search for"
              }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getPlayerSeasonAverages",
          description: "Get a player's season averages",
          parameters: {
            type: "object",
            properties: {
              playerId: {
                type: "integer",
                description: "The player ID"
              },
              season: {
                type: "integer",
                description: "Season year (e.g., 2024). If not provided, will use current season."
              }
            },
            required: ["playerId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getTeamGames",
          description: "Get games for a specific team",
          parameters: {
            type: "object",
            properties: {
              teamId: {
                type: "integer",
                description: "The team ID"
              },
              perPage: {
                type: "integer",
                description: "Number of games to fetch (default: 10)"
              },
              page: {
                type: "integer",
                description: "Page number for pagination (default: 1)"
              }
            },
            required: ["teamId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getAllTeams",
          description: "Get all NBA teams",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getPlayerGameStats",
          description: "Get a player's stats for a specific game date",
          parameters: {
            type: "object",
            properties: {
              playerName: {
                type: "string",
                description: "Player's name (e.g., 'LeBron James', 'Jayson Tatum')"
              },
              date: {
                type: "string",
                description: "Date in any format (e.g., 'May 7', '2023-05-07')"
              }
            },
            required: ["playerName", "date"]
          }
        }
      }
    ];
  }

  async executeFunctionCall(functionName, args) {
    console.log(`Executing function: ${functionName} with args:`, args);
    
    switch (functionName) {
      case 'getStandings':
        return await getStandings(args.type);
      case 'getTeamSchedule':
        return await getTeamSchedule(args.teamName);
      case 'getRecentGames':
        return await getRecentGames(args.date);
      case 'searchPlayers':
        return await searchPlayers(args.name);
      case 'getPlayerSeasonAverages':
        return await getPlayerSeasonAverages(args.playerId, args.season);
      case 'getTeamGames':
        return await getTeamGames(args.teamId, args.perPage, args.page);
      case 'getAllTeams':
        return await getAllTeams();
      case 'getPlayerGameStats':
        return await getPlayerGameStats(args.playerName, args.date);
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }
  
  // Process user query and generate response with conversation pruning
  async processQuery(query, conversationHistory = []) {
    // Prune conversation history to prevent token limit errors
    const prunedHistory = this.pruneConversationHistory(conversationHistory);
    
    // Format conversation history for GPT-4
    const messages = [
      {
        role: "system",
        content: `You are NBAStatsBot, an AI assistant specialized in NBA statistics and information using ESPN's API for the most up-to-date data.
        
        When responding:
        - Use getRecentGames for recent game scores
        - Use getTeamSchedule to find a team's latest games
        - Use searchPlayers and getPlayerSeasonAverages for player stats
        - Use getStandings for current NBA standings
        - For specific player performance on a date, use getPlayerGameStats
        
        Present information clearly:
        - Format scores as "Team A 123 - 115 Team B"
        - For player stats, highlight key statistics (PPG, RPG, APG)
        - When showing standings, include W-L record
        - If data isn't available, explain why and suggest alternatives
        - Mention that data comes from ESPN
        - If the answer is too long, focus on the most important information`
      },
      ...prunedHistory,
      { role: "user", content: query }
    ];

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: messages,
        tools: this.tools,
        tool_choice: "auto",
        max_tokens: 1000 // Limit response size to avoid token errors
      });

      const responseMessage = response.choices[0].message;
      
      // Check if the model wants to call a function
      if (responseMessage.tool_calls) {
        // Execute each tool call and collect results
        const toolResults = [];
        
        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          try {
            const functionResult = await this.executeFunctionCall(functionName, functionArgs);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: functionName,
              content: JSON.stringify(functionResult)
            });
          } catch (error) {
            console.error(`Error executing function ${functionName}:`, error);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: functionName,
              content: JSON.stringify({ error: error.message })
            });
          }
        }
        
        // Add the assistant's original response and the tool results to the conversation
        const updatedMessages = [
          ...messages,
          responseMessage,
          ...toolResults
        ];

        // Get a new response from the model with the tool results
        const secondResponse = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          messages: updatedMessages,
          max_tokens: 1000 // Limit response size to avoid token errors
        });

        return secondResponse.choices[0].message.content;
      } else {
        // No function call was needed, return the response directly
        return responseMessage.content;
      }
    } catch (error) {
      console.error("Error processing query:", error);
      if (error.message.includes("429") || error.message.includes("tokens")) {
        return `I encountered a limit while processing your request. Please try a shorter or more specific question.`;
      }
      return `I encountered an error while processing your request: ${error.message}`;
    }
  }
  
  // Helper method to limit conversation history and prevent token limit errors
  pruneConversationHistory(history, maxMessages = 6) {
    if (!history || history.length <= maxMessages) {
      return history;
    }
    
    // Keep only the most recent messages
    return history.slice(-maxMessages);
  }
}

export default NBAStatsBot;