import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminSettings from './pages/AdminSettings';
import Performance from './pages/Performance';
import DataEntry from './pages/DataEntry';
import TodaysAgents from './pages/TodaysAgents';
import { LayoutDashboard, Settings, LogOut, BarChart2, FileEdit, Users, RefreshCw } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import './index.css';

// Simple layout wrapper for authenticated routes
const AppLayout = ({ children }) => {
  const [agentsStatus, setAgentsStatus] = useState([]);
  const [loading, setLoading] = useState(false);

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
        .select('agent_id, is_leave')
        .eq('date', today);
      if (entriesErr) throw entriesErr;

      const entryMap = {};
      (entries || []).forEach(e => {
        entryMap[e.agent_id] = e.is_leave;
      });

      const statusList = (agents || []).map(agent => {
        let status = 'none'; // default
        if (entryMap[agent.id] !== undefined) {
          status = entryMap[agent.id] ? 'leave' : 'active';
        }
        return {
          id: agent.id,
          name: agent.name,
          team: agent.teams?.name || 'No Team',
          status
        };
      });

      setAgentsStatus(statusList);
    } catch (err) {
      console.error('Error fetching sidebar status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayStatus();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchTodayStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchTodayStatus]);

  return (
    <div className="app-container">
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
        <div>
          <h2 style={{ marginBottom: '2rem', color: 'var(--primary)' }}>Agent Dashboard</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link to="/dashboard" className="nav-link">
              <LayoutDashboard size={20} />
              Dashboard
            </Link>
            <Link to="/todays-agents" className="nav-link">
              <Users size={20} />
              Today's Agents
            </Link>
            <Link to="/data-entry" className="nav-link">
              <FileEdit size={20} />
              Insert Data
            </Link>
            <Link to="/performance" className="nav-link">
              <BarChart2 size={20} />
              Performance
            </Link>
            <Link to="/admin" className="nav-link">
              <Settings size={20} />
              Admin Settings
            </Link>
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
            {agentsStatus.map(agent => (
              <div key={agent.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <span style={{ color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                  {agent.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({agent.team})</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {agent.status === 'active' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} title="Active" />}
                  {agent.status === 'leave' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} title="On Leave" />}
                  {agent.status === 'none' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94a3b8' }} title="No Entry" />}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <Link to="/login" className="nav-link" style={{ color: 'var(--error)' }}>
            <LogOut size={20} />
            Logout
          </Link>
        </div>
      </aside>
      <main className="main-content" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/todays-agents" element={<AppLayout><TodaysAgents /></AppLayout>} />
        <Route path="/data-entry" element={<AppLayout><DataEntry /></AppLayout>} />
        <Route path="/performance" element={<AppLayout><Performance /></AppLayout>} />
        <Route path="/admin" element={<AppLayout><AdminSettings /></AppLayout>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
