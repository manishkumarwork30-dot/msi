import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, ShieldCheck, LogIn, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Login = () => {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState('agent'); // 'agent' | 'admin'

  // Admin login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Agent PIN login states
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [pin, setPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Load agents for dropdown
    const fetchAgents = async () => {
      try {
        const { data, error } = await supabase.from('agents').select('id, name, pin, teams(name)').order('name');
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
      loginTime: new Date().toISOString()
    }));

    navigate('/agent-entry');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100vw', padding: '1rem' }}>
      <div className="glass-panel" style={{ padding: '2rem 1.5rem', width: '100%', maxWidth: '420px', borderRadius: '12px' }}>
        
        {/* Login Type Switcher Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', backgroundColor: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => { setLoginType('agent'); setErrorMsg(''); }}
            className={`btn ${loginType === 'agent' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', justifyContent: 'center', border: 'none' }}
          >
            <UserCheck size={18} style={{ marginRight: '0.35rem' }} /> Agent Login
          </button>
          <button
            onClick={() => { setLoginType('admin'); setErrorMsg(''); }}
            className={`btn ${loginType === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', justifyContent: 'center', border: 'none' }}
          >
            <ShieldCheck size={18} style={{ marginRight: '0.35rem' }} /> Admin Login
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.85rem', backgroundColor: 'rgba(74, 222, 128, 0.1)', borderRadius: '50%', marginBottom: '0.75rem' }}>
            {loginType === 'agent' ? <KeyRound size={28} color="var(--primary)" /> : <LogIn size={28} color="var(--primary)" />}
          </div>
          <h2 style={{ fontSize: '1.4rem' }}>{loginType === 'agent' ? 'Agent PIN Portal' : 'Admin Login'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {loginType === 'agent' ? 'Apna naam aur PIN se login karein' : 'Sign in to access admin panel'}
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
        {loginType === 'agent' ? (
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
              <label style={{ fontSize: '0.85rem' }}>Enter 4-Digit PIN</label>
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
        ) : (
          /* ADMIN LOGIN FORM */
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
