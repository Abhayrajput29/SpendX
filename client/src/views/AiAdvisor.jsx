import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Send, Loader2, RefreshCw, Calendar } from 'lucide-react';
import { sanitizeHtml } from '../utils/sanitizeHtml';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

export default function AiAdvisor() {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [hasInitialized, setHasInitialized] = useState(false);
  const messagesEndRef = useRef(null);

  // Autoscroll chat history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadWelcomeInsight = useCallback(async (selectedMonth) => {
    try {
      setLoading(true);
      setMessages([]);
      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth })
      });

      const data = await res.json();
      const html = data.html || '<p>No insights available.</p>';

      setMessages([
        {
          sender: 'ai',
          html: `<h4>📊 FinanceAI — Monthly Portfolio Snapshot</h4>
                 <p>Analysing your spending for <strong>${new Date(selectedMonth + '-15').toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>. Ask me anything below.</p>
                 <div style="margin-top: 15px;">${html}</div>`
        }
      ]);
    } catch (err) {
      console.error(err);
      setMessages([
        {
          sender: 'ai',
          html: `<h4>⚠️ Connection Error</h4>
                 <p>Could not connect to the backend server. Please verify the Express server is running, then click <strong>Refresh</strong>.</p>`
        }
      ]);
    } finally {
      setLoading(false);
      setHasInitialized(true);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadWelcomeInsight(month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
    loadWelcomeInsight(newMonth);
  };

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
        body: JSON.stringify({ month, question: userText })
      });

      const data = await res.json();
      const html = data.html || '<p>No response generated.</p>';
      setMessages(prev => [...prev, { sender: 'ai', html }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        sender: 'ai',
        html: `<p>⚠️ Could not reach the server. Please check the backend is running and try again.</p>`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_QUESTIONS = [
    'Where am I overspending?',
    'Give me a savings plan',
    'Break down my food expenses',
    'How do I reduce my bills?',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="view-header" style={{ marginBottom: '16px' }}>
        <div className="view-title-container">
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={26} color="var(--color-primary)" /> AI Portfolio Advisor
          </h1>
          <p className="view-subtitle">Consult FinanceAI to diagnose spending trends and structure savings habits.</p>
        </div>

        {/* Month picker + refresh */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
            <input
              type="month"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '13px' }}
              disabled={loading}
            />
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => loadWelcomeInsight(month)}
            disabled={loading}
            title="Refresh insights"
            style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
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
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.html) }} />
              )}
            </div>
          ))}

          {loading && (
            <div className="chat-message message-ai" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 className="animate-spin" size={16} />
              <span>FinanceAI is analysing your portfolio...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick question chips */}
        {hasInitialized && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setUserInput(q);
                }}
                style={{
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.color = 'var(--color-primary)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.color = 'var(--text-secondary)'; }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

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
