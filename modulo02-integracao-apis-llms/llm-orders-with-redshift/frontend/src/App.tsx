import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  query?: string;
  followUpQuestions?: string[];
  processingTimeMs?: number;
  error?: string;
}

const API_URL = '/orders';

export default function App() {
  const [hostname, setHostname] = useState('acerstore');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSqlFor, setShowSqlFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendQuestion = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, hostname }),
      });
      const data = await res.json();

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || 'No answer generated.',
        query: data.query,
        followUpQuestions: data.followUpQuestions,
        processingTimeMs: data.processingTimeMs,
        error: data.error,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Connection error: ${err.message}`,
        error: err.message,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Orders Assistant</h1>
          <span style={styles.subtitle}>Text2SQL - RedShift + LangGraph</span>
        </div>
        <div style={styles.headerRight}>
          <label style={styles.storeLabel}>Store:</label>
          <input
            style={styles.storeInput}
            value={hostname}
            onChange={e => setHostname(e.target.value)}
            placeholder="hostname"
          />
        </div>
      </header>

      <main style={styles.chatArea}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>Ask anything about orders</p>
            <p style={styles.emptyHint}>
              Try: "Qual a distribuicao de status dos pedidos?" or "Top 10 products by revenue"
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              ...styles.messageBubble,
              ...(msg.role === 'user' ? styles.userBubble : styles.assistantBubble),
            }}
          >
            <div style={styles.messageRole}>
              {msg.role === 'user' ? 'You' : 'Assistant'}
              {msg.processingTimeMs && (
                <span style={styles.timing}>{(msg.processingTimeMs / 1000).toFixed(1)}s</span>
              )}
            </div>
            <div
              style={styles.messageContent}
              className={msg.role === 'assistant' ? 'md' : undefined}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              ) : (
                msg.content.split('\n').map((line, i, arr) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                  </React.Fragment>
                ))
              )}
            </div>

            {msg.query && (
              <div style={styles.sqlSection}>
                <button
                  style={styles.sqlToggle}
                  onClick={() => setShowSqlFor(showSqlFor === msg.id ? null : msg.id)}
                >
                  {showSqlFor === msg.id ? 'Hide SQL' : 'Show SQL'}
                </button>
                {showSqlFor === msg.id && (
                  <pre style={styles.sqlCode}>{msg.query}</pre>
                )}
              </div>
            )}

            {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
              <div style={styles.followUps}>
                {msg.followUpQuestions.map((q, i) => (
                  <button
                    key={i}
                    style={styles.followUpBtn}
                    onClick={() => sendQuestion(q)}
                    disabled={loading}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {msg.error && <div style={styles.errorBadge}>{msg.error}</div>}
          </div>
        ))}

        {loading && (
          <div style={{ ...styles.messageBubble, ...styles.assistantBubble }}>
            <div style={styles.messageRole}>Assistant</div>
            <div style={styles.loadingDots}>Querying RedShift...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <form onSubmit={handleSubmit} style={styles.inputBar}>
        <input
          style={styles.textInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about orders..."
          disabled={loading}
        />
        <button style={styles.sendBtn} type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#0f1117',
    color: '#e1e4e8',
    margin: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    borderBottom: '1px solid #21262d',
    background: '#161b22',
  },
  headerLeft: { display: 'flex', alignItems: 'baseline', gap: '12px' },
  title: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#f0f6fc' },
  subtitle: { fontSize: '12px', color: '#8b949e' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  storeLabel: { fontSize: '13px', color: '#8b949e' },
  storeInput: {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '6px 10px',
    color: '#c9d1d9',
    fontSize: '13px',
    width: '160px',
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  emptyState: { textAlign: 'center', marginTop: '120px', opacity: 0.6 },
  emptyTitle: { fontSize: '20px', marginBottom: '8px' },
  emptyHint: { fontSize: '14px', color: '#8b949e' },
  messageBubble: {
    maxWidth: '85%',
    padding: '12px 16px',
    borderRadius: '12px',
    lineHeight: 1.5,
  },
  userBubble: {
    alignSelf: 'flex-end',
    background: '#1f6feb',
    color: '#fff',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    background: '#161b22',
    border: '1px solid #30363d',
  },
  messageRole: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
    opacity: 0.7,
    display: 'flex',
    justifyContent: 'space-between',
  },
  timing: { fontWeight: 400, fontSize: '11px' },
  messageContent: { fontSize: '14px' },
  sqlSection: { marginTop: '8px' },
  sqlToggle: {
    background: 'none',
    border: '1px solid #30363d',
    borderRadius: '4px',
    color: '#58a6ff',
    fontSize: '11px',
    padding: '2px 8px',
    cursor: 'pointer',
  },
  sqlCode: {
    marginTop: '6px',
    padding: '10px',
    background: '#0d1117',
    borderRadius: '6px',
    fontSize: '12px',
    overflowX: 'auto' as const,
    color: '#79c0ff',
    border: '1px solid #21262d',
  },
  followUps: {
    marginTop: '10px',
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
  },
  followUpBtn: {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: '16px',
    color: '#c9d1d9',
    fontSize: '12px',
    padding: '4px 12px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  errorBadge: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#f85149',
    background: '#21090d',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #f8514933',
  },
  loadingDots: { fontSize: '14px', opacity: 0.7 },
  inputBar: {
    display: 'flex',
    gap: '8px',
    padding: '12px 24px',
    borderTop: '1px solid #21262d',
    background: '#161b22',
  },
  textInput: {
    flex: 1,
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#c9d1d9',
    fontSize: '14px',
    outline: 'none',
  },
  sendBtn: {
    background: '#238636',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
