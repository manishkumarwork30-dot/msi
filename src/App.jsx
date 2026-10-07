import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminSettings from './pages/AdminSettings';
import Performance from './pages/Performance';
import DataEntry from './pages/DataEntry';
import TodaysAgents from './pages/TodaysAgents';
import AuditAgent from './pages/AuditAgent';
import { LayoutDashboard, Settings, LogOut, BarChart2, FileEdit, Users, RefreshCw, ClipboardCheck } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import './index.css';

// Simple layout wrapper for authenticated routes
const AppLayout = ({ children }) => {
  const navigate = useNavigate();
  const [agentsStatus, setAgentsStatus] = useState([]);
  const [loading, setLoading] = useState(false);

  const agentSessionStr = localStorage.getItem('agent_session');
  const sessionData = agentSessionStr ? JSON.parse(agentSessionStr) : null;
  const isLeader = sessionData?.role === 'leader' || sessionData?.isLeader;


  const fetchTodayStatus = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Fetch all agents
      const { data: agents, error: agentsErr } = await supabase
        .from('agents')
        .select('id, name, teams(name)')
        .order('name');
      if (agentsErr) throw agentsErr;

      // Fetch entries for today
      const { data: entries, error: entriesErr } = await supabase
        .from('daily_entries')
        .select('agent_id, is_leave, updated_at')
        .eq('date', today);
      if (entriesErr) throw entriesErr;

      const entryMap = {};
      (entries || []).forEach(e => {
        entryMap[e.agent_id] = {
          is_leave: e.is_leave,
          updated_at: e.updated_at
        };
      });

      const statusList = (agents || []).map(agent => {
        let status = 'none'; // default
        let updatedAt = null;
        if (entryMap[agent.id] !== undefined) {
          status = entryMap[agent.id].is_leave ? 'leave' : 'active';
          updatedAt = entryMap[agent.id].updated_at;
        }
        return {
          id: agent.id,
          name: agent.name,
          team: agent.teams?.name || 'No Team',
          status,
          updatedAt
        };
      });

      setAgentsStatus(statusList);
    } catch (err) {
      console.error('Error fetching sidebar status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const formatTime = (isoString) => {
    if (!isoString) return null;
    try {
      return new Date(isoString).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetchTodayStatus();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchTodayStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchTodayStatus]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('agent_session');
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
        <div>
          <h2 style={{ marginBottom: '2rem', color: 'var(--primary)' }}>Agent Dashboard</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {!isLeader && (
              <Link to="/dashboard" className="nav-link">
                <LayoutDashboard size={20} />
                Dashboard
              </Link>
            )}
            {!isLeader && (
              <Link to="/todays-agents" className="nav-link">
                <Users size={20} />
                Today's Agents
              </Link>
            )}
            <Link to={isLeader ? "/leader-fee" : "/data-entry"} className="nav-link">
              <FileEdit size={20} />
              {isLeader ? "Agent Fee Entry" : "Insert Data"}
            </Link>
            {!isLeader && (
              <Link to="/performance" className="nav-link">
                <BarChart2 size={20} />
                Performance
              </Link>
            )}
            {!isLeader && (
              <Link to="/audit" className="nav-link">
                <ClipboardCheck size={20} />
                Audit Agent
              </Link>
            )}
            {!isLeader && (
              <Link to="/admin" className="nav-link">
                <Settings size={20} />
                Admin Settings
              </Link>
            )}
          </nav>
        </div>

        {/* Live Agent Status List in Sidebar */}
        <div style={{ marginTop: '2rem', flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Today's Agents ({agentsStatus.length})
            </span>
            <button 
              onClick={fetchTodayStatus} 
              disabled={loading}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {agentsStatus.map(agent => {
              const timeStr = formatTime(agent.updatedAt);
              let statusText = 'No Entry';
              if (agent.status === 'active') statusText = `Active${timeStr ? ` • ${timeStr}` : ''}`;
              if (agent.status === 'leave') statusText = `On Leave${timeStr ? ` • ${timeStr}` : ''}`;

              return (
                <div key={agent.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                    {agent.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({agent.team})</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {timeStr && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: '500' }}>
                        {timeStr}
                      </span>
                    )}
                    {agent.status === 'active' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} title={statusText} />}
                    {agent.status === 'leave' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} title={statusText} />}
                    {agent.status === 'none' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94a3b8', flexShrink: 0 }} title="No Entry" />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button 
            onClick={handleLogout}
            className="nav-link" 
            style={{ 
              color: 'var(--error)', 
              background: 'transparent', 
              border: 'none', 
              width: '100%', 
              cursor: 'pointer', 
              textAlign: 'left', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>
      <main className="main-content" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
};

import AgentEntry from './pages/AgentEntry';
import LeaderFeeEntry from './pages/LeaderFeeEntry';

// ProtectedRoute checks if a user session exists in Supabase or localStorage
const ProtectedRoute = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage session first
    const agentSessionStr = localStorage.getItem('agent_session');
    
    // Check current active Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session || (agentSessionStr ? JSON.parse(agentSessionStr) : null));
      setLoading(false);
    }).catch(() => {
      setSession(agentSessionStr ? JSON.parse(agentSessionStr) : null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentAgentSession = localStorage.getItem('agent_session');
      setSession(session || (currentAgentSession ? JSON.parse(currentAgentSession) : null));
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh', 
        backgroundColor: 'var(--bg-dark)', 
        color: 'var(--text-main)' 
      }}>
        Loading...
      </div>
    );
  }

  const agentSessionStr = localStorage.getItem('agent_session');
  if (!session && !agentSessionStr) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  useEffect(() => {
    const handleWheel = (e) => {
      if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/agent-entry" element={<AgentEntry />} />
        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/todays-agents" element={<ProtectedRoute><AppLayout><TodaysAgents /></AppLayout></ProtectedRoute>} />
        <Route path="/data-entry" element={<ProtectedRoute><AppLayout><DataEntry /></AppLayout></ProtectedRoute>} />
        <Route path="/leader-fee" element={<LeaderFeeEntry />} />
        <Route path="/performance" element={<ProtectedRoute><AppLayout><Performance /></AppLayout></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute><AppLayout><AuditAgent /></AppLayout></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AppLayout><AdminSettings /></AppLayout></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
