import React, { useState, useEffect } from 'react';
import { Users, Shield, Key, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('auth');

  // Teams & Agents lists from DB
  const [teams, setTeams] = useState([]);
  const [agentsList, setAgentsList] = useState([]);

  // Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // Edit states
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [editingAgentId, setEditingAgentId] = useState(null);
  const [editingAgentName, setEditingAgentName] = useState('');
  const [editingAgentTeamId, setEditingAgentTeamId] = useState('');

  // Load configuration details
  const loadData = async () => {
    try {
      const { data: teamsData } = await supabase.from('teams').select('*').order('name');
      setTeams(teamsData || []);

      const { data: agentsData } = await supabase.from('agents').select('*, teams(name)').order('name');
      setAgentsList(agentsData || []);
    } catch (err) {
      console.error('Error loading config data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('teams').insert([{ name: newTeamName }]);
      if (error) throw error;
      alert(`Team "${newTeamName}" created successfully!`);
      setNewTeamName('');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateTeam = async (teamId) => {
    if (!editingTeamName.trim()) return;
    try {
      const { error } = await supabase
        .from('teams')
        .update({ name: editingTeamName })
        .eq('id', teamId);
      if (error) throw error;
      alert('Team updated successfully!');
      setEditingTeamId(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Are you sure you want to delete this team? This will delete all assigned agents and their daily entries.')) return;
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);
      if (error) throw error;
      alert('Team deleted successfully!');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('agents').insert([{ name: newAgentName, team_id: selectedTeamId }]);
      if (error) throw error;
      alert(`Agent "${newAgentName}" created successfully!`);
      setNewAgentName('');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateAgent = async (agentId) => {
    if (!editingAgentName.trim()) return;
    try {
      const { error } = await supabase
        .from('agents')
        .update({ name: editingAgentName, team_id: editingAgentTeamId || null })
        .eq('id', agentId);
      if (error) throw error;
      alert('Agent updated successfully!');
      setEditingAgentId(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Are you sure you want to delete this agent? This will delete all their daily entries.')) return;
    try {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId);
      if (error) throw error;
      alert('Agent deleted successfully!');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Admin Settings</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage configurations, teams, and agents</p>
        </div>
        <button 
          onClick={loadData}
          className="btn btn-secondary" 
          style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Refresh Configurations"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Settings Navigation */}
        <div className="glass-panel" style={{ width: '250px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', height: 'fit-content' }}>
          <button 
            className={`btn ${activeTab === 'auth' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
            onClick={() => setActiveTab('auth')}
          >
            <Key size={18} style={{ marginRight: '0.5rem' }}/> Auth Settings
          </button>
          <button 
            className={`btn ${activeTab === 'teams' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
            onClick={() => setActiveTab('teams')}
          >
            <Shield size={18} style={{ marginRight: '0.5rem' }}/> Manage Teams
          </button>
          <button 
            className={`btn ${activeTab === 'agents' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
            onClick={() => setActiveTab('agents')}
          >
            <Users size={18} style={{ marginRight: '0.5rem' }}/> Manage Agents
          </button>
        </div>

        {/* Settings Content Area */}
        <div className="glass-panel" style={{ flex: 1, padding: '2rem' }}>
          
          {/* Auth Settings Tab */}
          {activeTab === 'auth' && (
            <div>
              <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={24} color="var(--primary)" /> 
                Authentication
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Write your manual authentication code in the source files. You can use this space to add forms for changing passwords or managing admin access.
              </p>
              
              <div className="input-group" style={{ maxWidth: '400px' }}>
                <label>Admin Email</label>
                <input type="text" className="input-field" disabled value="admin@example.com" />
              </div>
              <button className="btn btn-secondary">Update Credentials (Manual Logic Required)</button>
            </div>
          )}

          {/* Teams Settings Tab */}
          {activeTab === 'teams' && (
            <div>
              <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={24} color="var(--primary)" /> 
                Teams
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Create and manage teams.</p>
              
              <form onSubmit={handleCreateTeam} style={{ maxWidth: '400px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                <div className="input-group">
                  <label>New Team Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. UT" 
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary">Create Team</button>
              </form>

              <h3>Existing Teams</h3>
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '400px' }}>
                {teams.map(t => {
                  const isEditing = editingTeamId === t.id;
                  return (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                          <input 
                            type="text" 
                            className="input-field" 
                            value={editingTeamName} 
                            onChange={(e) => setEditingTeamName(e.target.value)} 
                            style={{ margin: 0, padding: '0.25rem 0.5rem', flex: 1 }} 
                          />
                          <button onClick={() => handleUpdateTeam(t.id)} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Save</button>
                          <button onClick={() => setEditingTeamId(null)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontWeight: '500' }}>{t.name}</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => { setEditingTeamId(t.id); setEditingTeamName(t.name); }} 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteTeam(t.id)} 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--error)' }}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agents Settings Tab */}
          {activeTab === 'agents' && (
            <div>
              <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={24} color="var(--primary)" /> 
                Agents
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Register new agents and assign them to teams.</p>
              
              <form onSubmit={handleCreateAgent} style={{ maxWidth: '400px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                <div className="input-group">
                  <label>Agent Name / ID</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. AU (UT)" 
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    required
                  />
                </div>
                 <div className="input-group">
                  <label>Assign to Team</label>
                  <select 
                    className="input-field" 
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    style={{ backgroundColor: '#1a1d24' }}
                  >
                    <option value="">No Team (None)</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">Create Agent</button>
              </form>

              <h3>Registered Agents</h3>
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {agentsList.map(a => {
                  const isEditing = editingAgentId === a.id;
                  return (
                    <div key={a.id} style={{ padding: '1rem', backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            className="input-field" 
                            value={editingAgentName} 
                            onChange={(e) => setEditingAgentName(e.target.value)} 
                            style={{ margin: 0, padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} 
                          />
                          <select 
                            className="input-field" 
                            value={editingAgentTeamId} 
                            onChange={(e) => setEditingAgentTeamId(e.target.value)} 
                            style={{ margin: 0, padding: '0.25rem 0.5rem', fontSize: '0.85rem', backgroundColor: '#1a1d24' }}
                          >
                            <option value="">No Team (None)</option>
                            {teams.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button onClick={() => handleUpdateAgent(a.id)} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', flex: 1 }}>Save</button>
                            <button onClick={() => setEditingAgentId(null)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', flex: 1 }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <div style={{ fontWeight: '600' }}>{a.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Team: {a.teams?.name || 'None'}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                            <button 
                              onClick={() => { setEditingAgentId(a.id); setEditingAgentName(a.name); setEditingAgentTeamId(a.team_id || ''); }} 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', flex: 1 }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteAgent(a.id)} 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', flex: 1, color: 'var(--error)' }}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
