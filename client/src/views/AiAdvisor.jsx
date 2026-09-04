import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Loader2, Bot } from 'lucide-react';

export default function AiAdvisor() {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  // Load welcome insights on mount
  useEffect(() => {
    const loadWelcomeInsight = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/advisor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: currentMonth })
        });
        if (res.ok) {
          const data = await res.json();
          setMessages([
            {
              sender: 'ai',
              html: `<h4>Welcome to FinanceAI Portfolio Insights!</h4>
                     <p>Here is your current monthly portfolio health summary. You can ask me custom questions about your expenses below.</p>
                     <div style="margin-top: 15px;">${data.html}</div>`
            }
          ]);
        } else {
          setMessages([
            {
              sender: 'ai',
              html: `<h4>FinanceAI Portfolio Assistant</h4>
                     <p>I am online but running in local fallback mode because no <strong>GEMINI_API_KEY</strong> was found. Standard reports are available, but interactive chat requires the API key configured in server/.env.</p>`
            }
          ]);
        }
      } catch (err) {
        console.error(err);
        setMessages([
          {
            sender: 'ai',
            html: `<h4>Advisor Offline</h4>
                   <p>Could not connect to the backend server. Please verify the Express backend is running on port 5001.</p>`
          }
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    loadWelcomeInsight();
  }, []);

  // Autoscroll chat history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;

    const userText = userInput.trim();
    setUserInput('');
    
    // Add user message to stack
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    
    try {
      setLoading(true);
      
      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          question: userText
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { sender: 'ai', html: data.html }]);
      } else {
        setMessages(prev => [...prev, { 
          sender: 'ai', 
          html: `<p class="warning-text">⚠️ Sorry, I encountered an issue parsing your data. Please ensure the backend is connected and configured.</p>` 
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { 
        sender: 'ai', 
        html: `<p class="warning-text">⚠️ Server connection timed out. Is the backend server running?</p>` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div className="view-header" style={{ marginBottom: '16px' }}>
        <div className="view-title-container">
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={26} color="var(--color-primary)" /> AI Portfolio Advisor
          </h1>
          <p className="view-subtitle">Consult FinanceAI to diagnose spending trends and structure savings habits.</p>
        </div>
      </div>

      <div className="card chat-container" style={{ flexGrow: 1, height: 'auto', display: 'flex', flexDirection: 'column', padding: '20px' }}>
        
        {/* Chat History Panel */}
        <div className="chat-messages" style={{ flexGrow: 1 }}>
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`chat-message ${msg.sender === 'user' ? 'message-user' : 'message-ai'}`}
            >
              {msg.sender === 'user' ? (
                <div>{msg.text}</div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: msg.html }} />
              )}
            </div>
          ))}

          {loading && (
            <div className="chat-message message-ai" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 className="animate-spin" size={16} />
              <span>Analyzing portfolio stats...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <form onSubmit={handleSend} className="chat-input-area">
          <input 
            type="text" 
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="e.g. Can you break down my food expenses? / Suggest a savings plan..."
            disabled={loading}
          />
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading || !userInput.trim()}
            style={{ width: '56px', height: '48px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Send size={18} />
          </button>
        </form>

      </div>
    </div>
  );
}
