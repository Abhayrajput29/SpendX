import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Send, Loader2, RefreshCw, Calendar } from 'lucide-react';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { useAuth } from '../context/AuthContext';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

export default function AiAdvisor() {
  const { isAuthenticated, requireAuth } = useAuth();
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [hasInitialized, setHasInitialized] = useState(false);
  const messagesEndRef = useRef(null);
  const requestVersionRef = useRef(0);

  // Autoscroll chat history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadWelcomeInsight = useCallback(async (selectedMonth) => {
    const requestVersion = ++requestVersionRef.current;
    if (!isAuthenticated) {
      setUserInput('');
      setMessages([
        {
          sender: 'ai',
          html: `<h4>✨ SpendX AI Financial Advisor</h4>
                 <p>Welcome to SpendX AI Advisor! Get real-time portfolio analysis, expense categorization, and smart budget advice.</p>
                 <p style="margin-top: 10px;">✦ <strong>Sign in</strong> or <strong>create a free account</strong> to sync your transactions and ask questions.</p>`
        }
      ]);
      setLoading(false);
      setHasInitialized(true);
      return;
    }

    try {
      setLoading(true);
      setMessages([]);
      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth })
      });

      if (requestVersion !== requestVersionRef.current) return;
      const data = await res.json();
      const html = data.html || '<p>No insights available.</p>';

      setMessages([
        {
          sender: 'ai',
          html: `<h4>📊 SpendX — Monthly Portfolio Snapshot</h4>
                 <p>Analysing your spending for <strong>${new Date(selectedMonth + '-15').toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>. Ask me anything below.</p>
                 <div style="margin-top: 15px;">${html}</div>`
        }
      ]);
    } catch (err) {
      if (requestVersion !== requestVersionRef.current) return;
      console.error(err);
      setMessages([
        {
          sender: 'ai',
          html: `<h4>⚠️ Connection Error</h4>
                 <p>Could not connect to the backend server. Please verify the Express server is running, then click <strong>Refresh</strong>.</p>`
        }
      ]);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
        setHasInitialized(true);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadWelcomeInsight(month);
  }, [loadWelcomeInsight, month]);

  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
  };

  const sendQuestion = async (question) => {
    const userText = question.trim();
    if (!userText || loading) return;

    requireAuth(async () => {
      const requestVersion = ++requestVersionRef.current;
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

        if (requestVersion !== requestVersionRef.current) return;
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Advisor request failed (${res.status})`);
        const html = data.html || '<p>No response generated.</p>';
        setMessages(prev => [...prev, { sender: 'ai', html }]);
      } catch (err) {
        if (requestVersion !== requestVersionRef.current) return;
        console.error(err);
        setMessages(prev => [...prev, {
          sender: 'ai',
          html: `<p>⚠️ Could not reach the server. Please check the backend is running and try again.</p>`
        }]);
      } finally {
        if (requestVersion === requestVersionRef.current) setLoading(false);
      }
    }, 'Sign in to chat with SpendX AI Advisor');
  };

  const handleSend = (e) => {
    e.preventDefault();
    void sendQuestion(userInput);
  };

  const QUICK_QUESTIONS = [
    'Where am I overspending?',
    'Give me a savings plan',
    'Break down my food expenses',
    'How do I reduce my bills?',
    'What is my biggest expense category?',
    'How much budget do I have left?',
    'Which merchant do I spend most at?',
  ];
  const visibleMessages = isAuthenticated ? messages : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="view-header" style={{ marginBottom: '16px' }}>
        <div className="view-title-container">
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={26} color="var(--color-primary)" /> AI Portfolio Advisor
          </h1>
          <p className="view-subtitle">Consult SpendX to diagnose spending trends and structure savings habits.</p>
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
          {visibleMessages.map((msg, index) => (
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
              <span>SpendX is analysing your portfolio...</span>
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
                onClick={() => void sendQuestion(q)}
                title="Ask SpendX AI"
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
            value={isAuthenticated ? userInput : ''}
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
