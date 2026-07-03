import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const TodaysAgents = () => {
  const [agentsList, setAgentsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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

      const list = (agents || []).map(agent => {
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

      setAgentsList(list);
    } catch (err) {
      console.error('Error fetching todays agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayStatus();
  }, [fetchTodayStatus]);

  // Compute summary stats
  const stats = agentsList.reduce(
    (acc, curr) => {
      acc.total += 1;
      if (curr.status === 'active') acc.active += 1;
      else if (curr.status === 'leave') acc.leave += 1;
      else acc.pending += 1;
      return acc;
    },
    { total: 0, active: 0, leave: 0, pending: 0 }
  );

  // Filters logic
  const filteredAgents = agentsList.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          agent.team.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Today's Agents</h1>
          <p style={{ color: 'var(--text-muted)' }}>Daily attendance and activity status overview</p>
        </div>
        <button 
          onClick={fetchTodayStatus} 
          disabled={loading}
          className="btn btn-secondary" 
          style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Refresh attendance"
        >
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--secondary)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Agents</span>
          <h2 style={{ fontSize: '2rem', marginTop: '0.25rem' }}>{stats.total}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #22c55e' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Active Today</span>
          <h2 style={{ fontSize: '2rem', marginTop: '0.25rem', color: '#22c55e' }}>{stats.active}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>On Leave</span>
          <h2 style={{ fontSize: '2rem', marginTop: '0.25rem', color: '#ef4444' }}>{stats.leave}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #94a3b8' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Pending Entries</span>
          <h2 style={{ fontSize: '2rem', marginTop: '0.25rem', color: '#94a3b8' }}>{stats.pending}</h2>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem 1rem', flex: 1, minWidth: '250px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Search agents by name or team..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', width: '100%', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        <div className="input-group" style={{ margin: 0, minWidth: '180px' }}>
          <select 
            className="input-field" 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ backgroundColor: '#1a1d24', margin: 0 }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Today</option>
            <option value="leave">On Leave</option>
            <option value="none">No Entry / Pending</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading agent list...</div>
      ) : filteredAgents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No agents match your filter criteria.
        </div>
      ) : (
        /* Status Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {filteredAgents.map(agent => (
            <div key={agent.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '600' }}>{agent.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Team: {agent.team}</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {agent.status === 'active' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#22c55e', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    <CheckCircle2 size={16} /> Active
                  </span>
                )}
                {agent.status === 'leave' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    <XCircle size={16} /> Leave
                  </span>
                )}
                {agent.status === 'none' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '500' }}>
                    <AlertCircle size={16} /> Pending
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TodaysAgents;
