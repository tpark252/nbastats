import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function App() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your NBA Stats Assistant. Ask me anything about NBA players, teams, games, or statistics!" }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const messagesEndRef = useRef(null);
  
  // Fetch teams on load for suggestions
  useEffect(() => {
    async function fetchTeams() {
      try {
        const response = await axios.get(`${API_BASE_URL}/teams`);
        setTeams(response.data);
      } catch (error) {
        console.error('Error fetching teams:', error);
      }
    }
    
    fetchTeams();
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    // Add user message to chat
    const userMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input
    setQuery('');
    setIsLoading(true);

      if (isRateLimited) {
    setMessages(prev => [
      ...prev,
      { 
        role: 'assistant', 
        content: 'Please wait a moment before sending another request.' 
      }
    ]);
    return;
  }
    setIsRateLimited(true);
    setTimeout(() => setIsRateLimited(false), 3000); 

    
    try {
      // Get conversation history excluding the system message
      const conversation_history = pruneConversationHistory(
        messages.filter(msg => msg.role !== 'system')
          .map(msg => ({ role: msg.role, content: msg.content }))
      );
      // Send request to API
      const response = await axios.post(`${API_BASE_URL}/chat`, {
        query: userMessage.content,
        conversation_history
      });
      
      // Add bot response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      console.error('Error querying API:', error);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error processing your request. Please try again later.' 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  const handleCategoryClick = (category) => {
    let promptText = '';
    
    switch(category) {
      case 'playerStats':
        promptText = 'Show me LeBron James stats this season';
        break;
      case 'gameResults':
        promptText = 'What was the score of the latest Lakers game?';
        break;
      case 'teamRankings':
        promptText = 'Show me the current NBA standings';
        break;
      case 'playerLookup':
        promptText = 'Tell me about Steph Curry';
        break;
    }
    
    setQuery(promptText);
  };
  // Function to format NBA scores in the message
  const formatScores = (text) => {
    const scorePattern = /([A-Za-z\s]+)\s+(\d+)\s*-\s*(\d+)\s+([A-Za-z\s]+)/g;
    
    // Replace pattern with styled version
    return text.replace(scorePattern, (match, team1, score1, score2, team2) => {
      const winningTeam = parseInt(score1) > parseInt(score2) ? team1 : team2;
      
      return `
        <div class="game-result">
          <div class="team ${team1.trim() === winningTeam.trim() ? 'winning-team' : ''}">
            <span class="team-name">${team1}</span>
            <span class="team-score">${score1}</span>
          </div>
          <div class="score-divider">-</div>
          <div class="team ${team2.trim() === winningTeam.trim() ? 'winning-team' : ''}">
            <span class="team-score">${score2}</span>
            <span class="team-name">${team2}</span>
          </div>
        </div>
      `;
    });
  };
  
    const WelcomeMessage = () => (
    <div className="message assistant-message">
      <div className="message-content welcome-message">
        <div className="welcome-header">
          <h2>NBA Stats AI Assistant</h2>
        </div>
        <p>Hi! I'm your NBA Stats Assistant. Ask me anything about NBA players, teams, games, or statistics!</p>
        <div className="welcome-features">
          <div className="feature">
            <span className="feature-icon">📊</span>
            <span>Player Stats</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🏆</span>
            <span>Game Results</span>
          </div>
          <div className="feature">
            <span className="feature-icon">📈</span>
            <span>Team Rankings</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🔍</span>
            <span>Player Lookup</span>
            
          </div>
        </div>
      </div>
    </div>
  );
  // Format player stats
  const formatStats = (text) => {
    // Pattern to match player stats sections
    const statsPattern = /([A-Za-z\s]+)(?:'s)?\s+stats(?:\s+for\s+the\s+season|\s+this\s+season|\s+for\s+.+season)?:?([\s\S]*?)(?=\n\n|$)/gi;
    
    // Pattern for stats line items
    const statLinePattern = /-\s+([\w\s\/]+):\s+([\d\.]+%?(?:\s+\([^)]+\))?)/g;
    
    return text.replace(statsPattern, (match, playerName, statsBlock) => {
      // Format the stats block with enhanced styling
      const formattedStats = statsBlock.replace(statLinePattern, 
        (match, statName, statValue) => `
          <div class="stat-line">
            <span class="stat-name">${statName}:</span>
            <span class="stat-value">${statValue}</span>
          </div>
        `
      );
      
      return `
        <div class="player-stats-card">
          <div class="player-name">${playerName}</div>
          <div class="stats-container">${formattedStats}</div>
        </div>
      `;
    });
  };
  
  // Process message content with formatting
  const processMessageContent = (content) => {
    if (typeof content !== 'string') return content;
    
    if (content.includes("Hi!") && content.includes("NBA Stats Assistant")) {
      return content;
    }
    
    // Apply formatting in sequence
    let processedContent = content;
    processedContent = formatScores(processedContent);
    processedContent = formatStats(processedContent);
    
    // Add citation styling for ESPN references
    processedContent = processedContent.replace(
      /(data was retrieved from ESPN)/gi, 
      '<span class="data-source">$1</span>'
    );
    
    // Format any URLs in the text
    processedContent = processedContent.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" class="message-link"> ESPN Game Details </a>'
    );
    
    return processedContent;
  };
    
  // Create HTML content from processed message
  const createMarkup = (content) => {
    return { __html: processMessageContent(content) };
  };
  const isRecommendationMessage = (content) => {
    return content.includes("recommend checking") || 
          content.includes("directly on a reliable") ||
          content.includes("sports news website");
  };

  const pruneConversationHistory = (history, maxItems = 6) => {
  // Keep the first message (welcome) and recent messages up to maxItems
  if (history.length <= maxItems) return history;
  
  // Keep welcome message and most recent messages
  return [
    history[0],
    ...history.slice(history.length - maxItems + 1)
  ];
};
  const renderMessage = (message, index) => {
    const isUser = message.role === 'user';
    
    const isWelcomeMessage = !isUser && index === 0;
    const isRecommendation = !isUser && isRecommendationMessage(message.content);
    const useSimpleRendering = isUser || isWelcomeMessage || isRecommendation;
    
    return (
      <div 
        key={index} 
        className={`message ${isUser ? 'user-message' : 'assistant-message'}`}
      >
        <div className={`message-content ${isRecommendation ? 'recommendation-box' : ''}`}>
          {useSimpleRendering ? (
            <p>{message.content}</p>
          ) : (
            <div dangerouslySetInnerHTML={createMarkup(message.content)} />
          )}
        </div>
      </div>
    );
  };

  // Suggest queries for the user
  const suggestedQueries = [
    "Who are the top scorers this season?",
    "Show me the latest Lakers game results",
    "What are LeBron James' stats?",
    "Compare the Celtics and Bucks",
    "Who had the most rebounds yesterday?"
  ];
  
  // Header component
  const Header = () => (
    <header>
      <div className="header-content">
        <div className="logo-container">
          <div className="logo-icon">🏀</div>
          <h1>NBA Stats AI Assistant</h1>
        </div>
        <p className="powered-by">
          Powered by <span className="api-text">ESPN API</span> and <span className="gpt-text">GPT-4</span>
        </p>
      </div>
    </header>
  );
  
  // Suggestion buttons component
  const SuggestionButtons = ({ queries, isDisabled, onSelect }) => (
    <div className="suggestions">
      <h3>Try asking about:</h3>
      <div className="suggestion-buttons">
        {queries.map((q, i) => (
          <button 
            key={i}
            onClick={() => onSelect(q)}
            disabled={isDisabled}
            className={`suggestion-button suggestion-${i % 4}`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <Header />
      
      <main>
      <div className="chat-container">
        <div className="messages">
          <WelcomeMessage />
          {messages.slice(1).map(renderMessage)}
            {isLoading && (
              <div className="message assistant-message">
                <div className="message-content loading">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSubmit} className="query-form">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about NBA stats, players, or games..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !query.trim()}>
              Send
            </button>
          </form>
        </div>
        
        <SuggestionButtons 
          queries={suggestedQueries} 
          isDisabled={isLoading} 
          onSelect={setQuery} 
        />
      </main>
      
      <style jsx>{`
        /* Global styles */
        .app-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
            Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          color: #333;
        }
        
        /* Header styles */
        header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 20px;
          background: linear-gradient(135deg, #043175, #0050b3);
          color: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
              /* Welcome message styling */
      .welcome-message {
        max-width: 100% !important;
        background: linear-gradient(135deg, #0a1c2e, #073a70);
        color: white;
        padding: 20px !important;
        border-radius: 12px;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
      }
      
      .welcome-header {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 15px;
      }
      
      .welcome-header h2 {
        margin: 0 15px;
        font-size: 22px;
        font-weight: 700;
        background: linear-gradient(90deg, #ff9c2b, #ff4e50);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-transform: uppercase;
      }
      
      .welcome-message p {
        text-align: center;
        margin-bottom: 20px;
        font-size: 16px;
        line-height: 1.5;
        color: white;
      }
      
      .welcome-features {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 15px;
        color: white;
      }
      
      .feature {
        flex: 1;
        min-width: 100px;
        background-color: rgba(255, 255, 255, 0.1);
        padding: 10px;
        border-radius: 8px;
        text-align: center;
        transition: all 0.3s ease;
      }
      
      .feature:hover {
        background-color: rgba(255, 255, 255, 0.2);
        transform: translateY(-3px);
      }
      
      .feature-icon {
        display: block;
        font-size: 20px;
        margin-bottom: 5px;
      }
        .header-content {
          max-width: 600px;
          margin: 0 auto;
        }
        
        .logo-container {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 5px;
        }
        
        .logo-icon {
          font-size: 30px;
          margin-right: 10px;
          animation: bounce 1.5s infinite ease-in-out;
        }
        
        header h1 {
          margin: 0;
          color: white;
          font-size: 28px;
          letter-spacing: 0.5px;
        }
        
        .powered-by {
          margin: 5px 0 0;
          font-size: 14px;
          opacity: 0.9;
        }
        
        .api-text {
          color: #ffc107;
          font-weight: bold;
        }
        
        .gpt-text {
          background: linear-gradient(90deg, #5ce3ff, #51a9ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: bold;
        }
        
        @keyframes bounce {
          0%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
        }
        
        /* Chat container */
        .chat-container {
          background: #f9f9fc;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
        }
        .recommendation-box {
          background: linear-gradient(to right, #e2f0fd, #d5e7f9) !important;
          border-left: 4px solid #0078ff !important;
          padding: 15px !important;
        }
        
        .messages {
          padding: 20px;
          max-height: 500px;
          overflow-y: auto;
          background-color: #f8fafc;
        }
        
        .message {
          margin-bottom: 15px;
          display: flex;
        }
        
        .user-message {
          justify-content: flex-end;
        }
        
        .message-content {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 18px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .user-message .message-content {
          background-color: #0078ff;
          color: white;
          border-bottom-right-radius: 5px;
        }
        
        .assistant-message .message-content {
          background-color: #ffffff;
          color: #212529;
          border-bottom-left-radius: 5px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }
        
        /* Game result styling */
        .game-result {
          display: flex;
          align-items: center;
          background: linear-gradient(135deg, #1a2a6c, #2a4858);
          border-radius: 12px;
          padding: 12px 16px;
          margin: 10px 0;
          color: white;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .team {
          display: flex;
          align-items: center;
          flex: 1;
        }
        
        .team:first-child {
          justify-content: flex-end;
        }
        
        .winning-team {
          font-weight: bold;
        }
        
        .winning-team .team-score {
          color: #ffc107; /* A bright gold/yellow color for winning scores */
        }

        .team-name {
          margin: 0 8px;
        }

        .team-score {
          font-size: 20px;
          font-weight: bold;
        }

        .score-divider {
          margin: 0 10px;
          font-size: 18px;
          color: #aaa;
        }

        .player-stats-card {
          background: linear-gradient(to right, #f7f9fc, #e2e8f0);
          border-radius: 12px;
          padding: 12px 16px;
          margin: 10px 0;
          border-left: 4px solid #0077cc;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .player-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #2c5282;
          border-bottom: 1px solid #cbd5e0;
          padding-bottom: 5px;
        }

        .stats-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 8px;
        }

        .stat-line {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }

        .stat-name {
          color: #4a5568;
        }

        .stat-value {
          font-weight: 600;
          color: #2d3748;
        }

        /* Form styling */
        .query-form {
          display: flex;
          padding: 15px;
          background: #fff;
          border-top: 1px solid #eee;
          border-radius: 0 0 10px 10px;
        }

        .query-form input {
          flex: 1;
          padding: 12px 20px;
          border: 1px solid #ddd;
          border-radius: 20px;
          font-size: 16px;
          outline: none;
          transition: all 0.3s;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }

        .query-form input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
        }

        .query-form button {
          margin-left: 10px;
          padding: 12px 24px;
          background-color: #0078ff;
          color: white;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.3s;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        .query-form button:hover {
          background-color: #0062cc;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .query-form button:active {
          transform: translateY(1px);
        }

        .query-form button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        /* Loading indicator */
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 30px;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
        }

        .typing-indicator span {
          height: 8px;
          width: 8px;
          background-color: #3b82f6;
          border-radius: 50%;
          display: inline-block;
          margin: 0 2px;
          animation: bounce 1.5s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
          background-color: #2563eb;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
          background-color: #1e40af;
        }

        /* Suggestions */
        .suggestions {
          margin-top: 20px;
        }

        .suggestions h3 {
          margin-bottom: 12px;
          font-size: 18px;
          color: #555;
          text-align: center;
        }

        .suggestion-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .suggestion-button {
          background-color: #fff;
          border: 1px solid #ddd;
          border-radius: 20px;
          padding: 10px 16px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          position: relative;
          overflow: hidden;
        }

        .suggestion-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          transition: all 0.3s;
        }

        .suggestion-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .suggestion-button:active {
          transform: translateY(1px);
        }

        .suggestion-0::before { background-color: #f43f5e; }
        .suggestion-1::before { background-color: #f59e0b; }
        .suggestion-2::before { background-color: #10b981; }
        .suggestion-3::before { background-color: #3b82f6; }

        .suggestion-0:hover { border-color: #f43f5e; }
        .suggestion-1:hover { border-color: #f59e0b; }
        .suggestion-2:hover { border-color: #10b981; }
        .suggestion-3:hover { border-color: #3b82f6; }

        .suggestion-button:disabled {
          background-color: #f1f1f1;
          color: #999;
          cursor: not-allowed;
          transform: none;
        }

        /* Other styling elements */
        .data-source {
          font-style: italic;
          color: #718096;
          font-size: 0.9em;
          display: block;
          margin-top: 8px;
        }

        .message-link {
          display: inline-block;
          margin-top: 8px;
          color: #3182ce;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
          padding: 4px 10px;
          border-radius: 4px;
          background-color: #ebf8ff;
        }

        .message-link:hover {
          color: #2c5282;
          text-decoration: underline;
          background-color: #bee3f8;
        `}</style>
        </div>)}

        export default App;