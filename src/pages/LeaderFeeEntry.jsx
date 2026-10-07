import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle2, UserCheck, LogOut, FileText, MapPin, PlusCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const STATE_KEYS = ['pb', 'hr', 'jk', 'hp', 'mp', 'rj', 'up', 'br', 'mh', 'others'];
const STATE_LABELS = {
  pb: 'PB (Punjab)',
  hr: 'HR (Haryana)',
  jk: 'JK (Jammu & Kashmir)',
  hp: 'HP (Himachal)',
  mp: 'MP (Madhya Pradesh)',
  rj: 'RJ (Rajasthan)',
  up: 'UP (Uttar Pradesh)',
  br: 'BR (Bihar)',
  mh: 'MH (Maharashtra)',
  others: 'OTHERS'
};

const LeaderFeeEntry = () => {
  const navigate = useNavigate();
  const [leaderSession, setLeaderSession] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Fee-only fields (completely separate from files/state columns)
  const [selectedState, setSelectedState] = useState('pb');
  const [feeCount, setFeeCount] = useState('1');

  // Existing row from DB
  const [existingData, setExistingData] = useState(null);

  const [fetchingExisting, setFetchingExisting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');

  useEffect(() => {
    const sessionStr = localStorage.getItem('agent_session');
    if (!sessionStr) { navigate('/login'); return; }
    try {
      const session = JSON.parse(sessionStr);
      if (session.role !== 'leader') { navigate('/login'); return; }
      setLeaderSession(session);
      supabase.from('agents').select('id, name, teams(name)').order('name').then(({ data }) => {
        if (data) setAgents(data);
      });
    } catch {
      localStorage.removeItem('agent_session');
      navigate('/login');
    }
  }, [navigate]);

  const fetchExistingEntry = async () => {
    if (!selectedAgentId || !date) { setExistingData(null); return; }
    setFetchingExisting(true);
    try {
      const { data, error } = await supabase
        .from('daily_entries')
        .select('id, fee, fee_states')
        .eq('agent_id', selectedAgentId)
        .eq('date', date)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setExistingData(data || null);
    } catch (err) {
      console.error('Error fetching entry:', err);
    } finally {
      setFetchingExisting(false);
    }
  };

  useEffect(() => { fetchExistingEntry(); }, [selectedAgentId, date]);

  const handleLogout = () => {
    localStorage.removeItem('agent_session');
    navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAgentId) { setErrorMsg('Agent select karo pehle.'); return; }

    setSaveStatus('saving');
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const { data: currentData } = await supabase
        .from('daily_entries')
        .select('id, fee, fee_states')
        .eq('agent_id', selectedAgentId)
        .eq('date', date)
        .maybeSingle();

      const stKey = selectedState.toLowerCase();
      const addedCount = parseInt(feeCount) || 1;
      const currentFeeStates = currentData?.fee_states || {};
      const currentStateFeeCount = parseInt(currentFeeStates[stKey]) || 0;
      const currentTotalFee = parseInt(currentData?.fee) || 0;

      const newFeeStates = {
        ...currentFeeStates,
        [stKey]: currentStateFeeCount + addedCount
      };

      if (currentData?.id) {
        // Row exists: update ONLY fee & fee_states — DO NOT touch file state columns
        const { error } = await supabase
          .from('daily_entries')
          .update({ fee: currentTotalFee + addedCount, fee_states: newFeeStates })
          .eq('id', currentData.id);
        if (error) throw error;
      } else {
        // No row: insert minimal with fee only
        const { error } = await supabase
          .from('daily_entries')
          .insert({
            agent_id: selectedAgentId, date,
            fee: addedCount, fee_states: newFeeStates,
            calls: 0, files: 0, entry: 0, is_leave: false
          });
        if (error) throw error;
      }

      setSaveStatus('saved');
      setSuccessMsg('Fee save ho gayi! Aur add kar sakte ho.');
      setFeeCount('1');
      fetchExistingEntry();
      setTimeout(() => { setSaveStatus('idle'); setSuccessMsg(''); }, 5000);
    } catch (err) {
      console.error('Error saving fee:', err);
      setErrorMsg(err.message || 'Save karne mein error aaya.');
      setSaveStatus('idle');
    }
  };

  const feeStates = existingData?.fee_states || {};
  const totalFee = existingData?.fee || 0;
  const hasFees = totalFee > 0;

  if (!leaderSession) return null;

  return (
    <div style={{ minHeight: '100vh', width: '100vw', backgroundColor: 'var(--bg-dark)', color: 'var(--text-main)', padding: '1rem' }}>

      {/* Header */}
      <div className="glass-panel" style={{
        maxWidth: '540px', margin: '0 auto 1.25rem auto',
        padding: '1rem 1.25rem', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.6rem', backgroundColor: 'rgba(74,222,128,0.15)', borderRadius: '50%' }}>
            <UserCheck size={24} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{leaderSession.name}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Team Leader</span>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary"
          style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--error)' }}>
          <LogOut size={16} /> Switch
        </button>
      </div>

      {/* Form Card */}
      <div className="glass-panel" style={{ maxWidth: '540px', margin: '0 auto', padding: '1.5rem', borderRadius: '12px' }}>

        <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--primary)" /> Fee Entry
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            Fee alag track hoti hai — files se bilkul alag
          </p>
        </div>

        {fetchingExisting && (
          <div style={{ textAlign: 'center', padding: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Loading...</div>
        )}

        {successMsg && (
          <div style={{
            backgroundColor: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e',
            color: '#4ade80', padding: '0.75rem', borderRadius: '8px',
            marginBottom: '1rem', fontSize: '0.9rem', display: 'flex',
            alignItems: 'center', gap: '0.5rem', justifyContent: 'center'
          }}>
            <CheckCircle2 size={18} /> {successMsg}
          </div>
        )}

        {errorMsg && (
          <div style={{
            backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid var(--error)',
            color: '#f87171', padding: '0.75rem', borderRadius: '8px',
            marginBottom: '1rem', fontSize: '0.85rem', textAlign: 'center'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={15} color="var(--primary)" /> Date
            </label>
            <input type="date" className="input-field" value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ backgroundColor: '#181b22', fontSize: '1rem', padding: '0.75rem' }} required />
          </div>

          <div className="input-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <UserCheck size={15} color="var(--primary)" /> Agent
            </label>
            <select className="input-field" value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              style={{ backgroundColor: '#181b22', padding: '0.75rem', fontSize: '1rem', color: 'var(--text-main)' }} required>
              <option value="">-- Agent chuniye --</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.teams?.name || 'No Team'})</option>
              ))}
            </select>
          </div>

          {selectedAgentId && (
            <div style={{
              padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)',
              borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid var(--border-color)'
            }}>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={15} color="var(--primary)" /> State
                </label>
                <select className="input-field" value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  style={{ backgroundColor: '#181b22', padding: '0.75rem', fontSize: '1rem', color: 'var(--text-main)' }}>
                  {STATE_KEYS.map(st => (
                    <option key={st} value={st}>{STATE_LABELS[st]}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.85rem' }}>Kitni fees? (Count, default 1)</label>
                <input type="number" min="1" step="1" className="input-field"
                  placeholder="1" value={feeCount}
                  onChange={(e) => setFeeCount(e.target.value)}
                  style={{ fontSize: '1.2rem', padding: '0.75rem', fontWeight: 'bold' }} required />
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary"
            style={{
              width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 'bold',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
              backgroundColor: saveStatus === 'saved' ? '#22c55e' : undefined,
              transition: 'background-color 0.3s ease'
            }}
            disabled={saveStatus === 'saving' || !selectedAgentId}>
            {saveStatus === 'saving' ? 'Saving...' :
              saveStatus === 'saved' ? '✔ Add More' :
                <><PlusCircle size={18} /> Add Fee</>}
          </button>
        </form>

        {/* Fee Breakdown - 100% separate from files */}
        {selectedAgentId && hasFees && (
          <div style={{
            marginTop: '1.5rem', padding: '1rem',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.07), rgba(16,185,129,0.04))',
            borderRadius: '10px', border: '1px solid rgba(34,197,94,0.25)'
          }}>
            <div style={{
              fontSize: '0.75rem', color: '#4ade80', fontWeight: '700',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem'
            }}>
              Fees Added Today
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.9rem' }}>
              {STATE_KEYS.map(st => {
                const val = parseInt(feeStates[st]) || 0;
                if (val === 0) return null;
                return (
                  <div key={st} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '0.4rem 0.75rem',
                    background: 'rgba(34,197,94,0.12)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: '8px', minWidth: '52px'
                  }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      {st.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#4ade80', lineHeight: 1.2 }}>
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: '1px solid rgba(34,197,94,0.2)', paddingTop: '0.6rem'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Fees</span>
              <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#4ade80' }}>{totalFee}</span>
            </div>
          </div>
        )}

        {selectedAgentId && !hasFees && !fetchingExisting && (
          <div style={{
            marginTop: '1.25rem', textAlign: 'center',
            color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.75rem',
            border: '1px dashed var(--border-color)', borderRadius: '8px'
          }}>
            Aaj koi fee add nahi ki gayi abhi tak
          </div>
        )}

      </div>
    </div>
  );
};

export default LeaderFeeEntry;
