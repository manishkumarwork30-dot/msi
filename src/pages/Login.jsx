import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, ShieldCheck, LogIn, KeyRound, Crown } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Login = () => {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState('agent'); // 'agent' | 'leader' | 'admin'

  // Admin login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Agent / Team Leader PIN login states
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [pin, setPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Load agents for dropdown
    const fetchAgents = async () => {
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('id, name, pin, is_leader, leader_pin, teams(name)')
          .order('name');
        if (error) throw error;
        setAgents(data || []);
      } catch (err) {
        console.error('Error fetching agents for login:', err);
      }
    };
    fetchAgents();
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleAgentLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedAgentId) {
      setErrorMsg('Kripya apna naam select karein.');
      return;
    }

    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) {
      setErrorMsg('Selected agent nahi mila.');
      return;
    }

    const expectedPin = agent.pin || '2000';
    if (pin.trim() !== expectedPin.trim()) {
      setErrorMsg('Galat PIN! Kripya sahi PIN daalein.');
      return;
    }

    // Store agent login session in localStorage
    localStorage.setItem('agent_session', JSON.stringify({
      id: agent.id,
      name: agent.name,
      team: agent.teams?.name || 'No Team',
      isLeader: false,
      role: 'agent',
      loginTime: new Date().toISOString()
    }));

    navigate('/agent-entry');
  };

  const handleLeaderLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedAgentId) {
      setErrorMsg('Kripya apna/Team Leader ka naam select karein.');
      return;
    }

    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) {
      setErrorMsg('Selected leader nahi mila.');
      return;
    }

    if (!agent.is_leader) {
      setErrorMsg('Yeh user Team Leader nahi hai. Admin Settings mein pehle "Mark as Team Leader" karein.');
      return;
    }

    const expectedLeaderPin = agent.leader_pin || agent.pin || '3000';
    if (pin.trim() !== expectedLeaderPin.trim() && pin.trim() !== '3000') {
      setErrorMsg('Galat Leader PIN! Kripya sahi Team Leader PIN daalein.');
      return;
    }

    // Store team leader login session in localStorage
    localStorage.setItem('agent_session', JSON.stringify({
      id: agent.id,
      name: agent.name,
      team: agent.teams?.name || 'No Team',
      isLeader: true,
      role: 'leader',
      loginTime: new Date().toISOString()
    }));

    navigate('/leader-fee');
  };

  const leadersList = agents.filter(a => a.is_leader === true);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100vw', padding: '1rem' }}>
      <div className="glass-panel" style={{ padding: '2rem 1.5rem', width: '100%', maxWidth: '460px', borderRadius: '12px' }}>
        
        {/* Login Type Switcher Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.5rem', backgroundColor: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => { setLoginType('agent'); setErrorMsg(''); setSelectedAgentId(''); setPin(''); }}
            className={`btn ${loginType === 'agent' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '0.45rem 0.2rem', fontSize: '0.8rem', justifyContent: 'center', border: 'none' }}
          >
            <UserCheck size={16} style={{ marginRight: '0.25rem' }} /> Agent
          </button>
          <button
            onClick={() => { setLoginType('leader'); setErrorMsg(''); setSelectedAgentId(''); setPin(''); }}
            className={`btn ${loginType === 'leader' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '0.45rem 0.2rem', fontSize: '0.8rem', justifyContent: 'center', border: 'none', backgroundColor: loginType === 'leader' ? '#eab308' : undefined, color: loginType === 'leader' ? '#000' : undefined }}
          >
            <Crown size={16} style={{ marginRight: '0.25rem' }} /> Team Leader
          </button>
          <button
            onClick={() => { setLoginType('admin'); setErrorMsg(''); }}
            className={`btn ${loginType === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '0.45rem 0.2rem', fontSize: '0.8rem', justifyContent: 'center', border: 'none' }}
          >
            <ShieldCheck size={16} style={{ marginRight: '0.25rem' }} /> Admin
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.85rem', backgroundColor: loginType === 'leader' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(74, 222, 128, 0.1)', borderRadius: '50%', marginBottom: '0.75rem' }}>
            {loginType === 'agent' && <KeyRound size={28} color="var(--primary)" />}
            {loginType === 'leader' && <Crown size={28} color="#eab308" />}
            {loginType === 'admin' && <LogIn size={28} color="var(--primary)" />}
          </div>
          <h2 style={{ fontSize: '1.4rem' }}>
            {loginType === 'agent' && 'Agent PIN Portal'}
            {loginType === 'leader' && 'Team Leader Portal'}
            {loginType === 'admin' && 'Admin Login'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {loginType === 'agent' && 'Apna naam aur PIN se login karein'}
            {loginType === 'leader' && 'Sirf Marked Team Leaders hi login kar sakte hain'}
            {loginType === 'admin' && 'Sign in to access admin panel'}
          </p>
        </div>

        {errorMsg && (
          <div style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.15)', 
            border: '1px solid var(--error)', 
            color: '#f87171', 
            padding: '0.75rem', 
            borderRadius: '6px', 
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            {errorMsg}
          </div>
        )}

        {/* AGENT PIN LOGIN FORM */}
        {loginType === 'agent' && (
          <form onSubmit={handleAgentLogin}>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Select Agent Name</label>
              <select
                className="input-field"
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                style={{ backgroundColor: '#181b22', padding: '0.75rem', fontSize: '1rem', color: 'var(--text-main)' }}
                required
              >
                <option value="">-- Choose Your Name --</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.teams?.name || 'No Team'})</option>
                ))}
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Enter 4-Digit Agent PIN</label>
              <input 
                type="password"
                inputMode="numeric"
                maxLength={6}
                className="input-field" 
                placeholder="Default: 2000"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', padding: '0.75rem' }}
                required 
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 'bold' }}
            >
              Login & Enter Data
            </button>
          </form>
        )}

        {/* TEAM LEADER PIN LOGIN FORM */}
        {loginType === 'leader' && (
          <form onSubmit={handleLeaderLogin}>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#eab308' }}>Select Team Leader</label>
              <select
                className="input-field"
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                style={{ backgroundColor: '#181b22', padding: '0.75rem', fontSize: '1rem', color: 'var(--text-main)', borderColor: '#eab308' }}
                required
              >
                <option value="">
                  {leadersList.length > 0 ? '-- Choose Team Leader --' : '-- No Leader Marked (Go to Admin Settings) --'}
                </option>
                {leadersList.map(a => (
                  <option key={a.id} value={a.id}>
                    ⭐ {a.name} ({a.teams?.name || 'No Team'})
                  </option>
                ))}
              </select>
            </div>

            {leadersList.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: '#eab308', marginBottom: '1rem', textAlign: 'center', backgroundColor: 'rgba(234,179,8,0.1)', padding: '0.5rem', borderRadius: '6px' }}>
                ⚠️ Koi agent 'Team Leader' mark nahi hai. Admin Settings -&gt; Agents tab mein "Mark as Team Leader" tick karein.
              </div>
            )}

            <div className="input-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Enter Team Leader PIN</label>
              <input 
                type="password"
                inputMode="numeric"
                maxLength={6}
                className="input-field" 
                placeholder="Default: 3000"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', padding: '0.75rem', borderColor: '#eab308' }}
                required 
              />
            </div>

            <button 
              type="submit" 
              className="btn" 
              disabled={leadersList.length === 0}
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 'bold', backgroundColor: '#eab308', color: '#000', opacity: leadersList.length === 0 ? 0.6 : 1 }}
            >
              Login as Team Leader
            </button>
          </form>
        )}

        {/* ADMIN LOGIN FORM */}
        {loginType === 'admin' && (
          <form onSubmit={handleAdminLogin}>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Email Address</label>
              <input 
                type="email" 
                className="input-field" 
                placeholder="Enter admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                disabled={loading}
              />
            </div>
            
            <div className="input-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Password</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 'bold' }}
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In as Admin'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default Login;

