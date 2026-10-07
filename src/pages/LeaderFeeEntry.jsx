import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, PhoneCall, CheckCircle2, UserCheck, LogOut, FileText, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const STATE_KEYS = ['pb', 'hr', 'jk', 'hp', 'mp', 'rj', 'up', 'br', 'nk', 'mh', 'others'];
const STATE_LABELS = {
  pb: 'PB (Punjab)',
  hr: 'HR (Haryana)',
  jk: 'JK (Jammu & Kashmir)',
  hp: 'HP (Himachal)',
  mp: 'MP (Madhya Pradesh)',
  rj: 'RJ (Rajasthan)',
  up: 'UP (Uttar Pradesh)',
  br: 'BR (Bihar)',
  nk: 'NK (Nagaland/North)',
  mh: 'MH (Maharashtra)',
  others: 'OTHERS'
};

const LeaderFeeEntry = () => {
  const navigate = useNavigate();
  const [leaderSession, setLeaderSession] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fee, setFee] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetchingExisting, setFetchingExisting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'

  // Check login session on mount
  useEffect(() => {
    const sessionStr = localStorage.getItem('agent_session');
    if (!sessionStr) {
      navigate('/login');
      return;
    }
    try {
      const session = JSON.parse(sessionStr);
      if (session.role !== 'leader') {
        navigate('/login');
        return;
      }
      setLeaderSession(session);
      
      // Fetch agents
      supabase.from('agents').select('id, name, teams(name)').order('name').then(({ data }) => {
        if (data) setAgents(data);
      });
    } catch {
      localStorage.removeItem('agent_session');
      navigate('/login');
    }
  }, [navigate]);

  // Fetch existing entry when agent session or date changes
  useEffect(() => {
    if (!selectedAgentId || !date) return;

    const fetchExistingEntry = async () => {
      setFetchingExisting(true);
      setErrorMsg('');
      try {
        const { data, error } = await supabase
          .from('daily_entries')
          .select('*')
          .eq('agent_id', selectedAgentId)
          .eq('date', date)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setFee(data.fee || '');
        } else {
          setFee('');
        }
      } catch (err) {
        console.error('Error fetching existing entry:', err);
      } finally {
        setFetchingExisting(false);
      }
    };

    fetchExistingEntry();
  }, [selectedAgentId, date]);

  const handleLogout = () => {
    localStorage.removeItem('agent_session');
    navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAgentId) {
      setErrorMsg("Please select an agent first.");
      return;
    }

    setSaveStatus('saving');
    setSuccessMsg('');
    setErrorMsg('');

    try {
      // Fetch existing to merge
      const { data: existingData } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('agent_id', selectedAgentId)
        .eq('date', date)
        .maybeSingle();

      const payload = {
        ...(existingData || {}),
        agent_id: selectedAgentId,
        date,
        fee: parseFloat(fee) || 0
      };

      const { error } = await supabase
        .from('daily_entries')
        .upsert([payload], { onConflict: 'agent_id, date' });

      if (error) throw error;

      setSaveStatus('saved');
      setSuccessMsg('Database mei save ho gya hai!');
      setTimeout(() => {
        setSuccessMsg('');
        setSaveStatus('idle');
      }, 4000);
    } catch (err) {
      console.error('Error saving entry:', err);
      setErrorMsg(err.message || 'Failed to save entry. Please try again.');
      setSaveStatus('idle');
    }
  };

  if (!leaderSession) return null;

  return (
    <div style={{ minHeight: '100vh', width: '100vw', backgroundColor: 'var(--bg-dark)', color: 'var(--text-main)', padding: '1rem' }}>
      
      {/* Top Header Card */}
      <div className="glass-panel" style={{ 
        maxWidth: '540px', 
        margin: '0 auto 1.25rem auto', 
        padding: '1rem 1.25rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.6rem', backgroundColor: 'rgba(74, 222, 128, 0.15)', borderRadius: '50%' }}>
            <UserCheck size={24} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{leaderSession.name}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Role: Team Leader</span>
          </div>
        </div>

        <button 
          onClick={handleLogout} 
          className="btn btn-secondary" 
          style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--error)' }}
        >
          <LogOut size={16} /> Switch Agent
        </button>
      </div>

      {/* Main Data Entry Mobile Form Card */}
      <div className="glass-panel" style={{ maxWidth: '540px', margin: '0 auto', padding: '1.5rem', borderRadius: '12px' }}>
        
        <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', pb: '0.75rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--primary)" /> Agent Fee Entry
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            Enter fee collected for agents
          </p>
        </div>

        {fetchingExisting && (
          <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Loading existing data for {date}...
          </div>
        )}

        {successMsg && (
          <div style={{ 
            backgroundColor: 'rgba(34, 197, 94, 0.15)', 
            border: '1px solid #22c55e', 
            color: '#4ade80', 
            padding: '0.75rem', 
            borderRadius: '8px', 
            marginBottom: '1rem', 
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            justifyContent: 'center'
          }}>
            <CheckCircle2 size={18} /> {successMsg}
          </div>
        )}

        {errorMsg && (
          <div style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.15)', 
            border: '1px solid var(--error)', 
            color: '#f87171', 
            padding: '0.75rem', 
            borderRadius: '8px', 
            marginBottom: '1rem', 
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {/* Date Picker Field */}
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={15} color="var(--primary)" /> Select Date
            </label>
            <input 
              type="date" 
              className="input-field" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ backgroundColor: '#181b22', fontSize: '1rem', padding: '0.75rem' }}
              required
            />
          </div>

          {/* Agent Selection */}
          <div className="input-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <UserCheck size={15} color="var(--primary)" /> Select Agent
            </label>
            <select
              className="input-field"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              style={{ backgroundColor: '#181b22', padding: '0.75rem', fontSize: '1rem', color: 'var(--text-main)' }}
              required
            >
              <option value="">-- Choose Agent --</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.teams?.name || 'No Team'})</option>
              ))}
            </select>
          </div>

          {/* Fee Input Field */}
          {selectedAgentId && (
            <div className="input-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>₹</span> Fee Collected
              </label>
              <input 
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="input-field" 
                placeholder="e.g. 500"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                style={{ fontSize: '1.1rem', padding: '0.75rem', borderColor: '#22c55e' }}
              />
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            className={`btn ${saveStatus === 'saved' ? '' : 'btn-primary'}`} 
            style={{ 
              width: '100%', 
              padding: '0.85rem', 
              fontSize: '1.05rem', 
              fontWeight: 'bold', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '0.5rem',
              backgroundColor: saveStatus === 'saved' ? '#22c55e' : undefined,
              color: saveStatus === 'saved' ? '#fff' : undefined,
              transition: 'all 0.3s ease'
            }}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving to Database...' : 
             saveStatus === 'saved' ? '✔ Saved in Database' : 
             'Save Fee Data'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default LeaderFeeEntry;
