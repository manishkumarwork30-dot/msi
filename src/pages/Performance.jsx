import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Users, ArrowUpRight, RefreshCw } from 'lucide-react';

const stateColumns = ['PB', 'HR', 'JK', 'HP', 'MP', 'RJ', 'UP', 'BR', 'OTHERS'];

const Performance = () => {
  const [activeTab, setActiveTab] = useState('agent');
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  
  // Filter types: 'single', 'range', 'month'
  const [filterType, setFilterType] = useState('month');
  
  // Filter Values
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const [agentEntries, setAgentEntries] = useState([]);
  const [teamSummary, setTeamSummary] = useState([]);
  const [teamDateSummary, setTeamDateSummary] = useState([]);
  const [teamMonthSummary, setTeamMonthSummary] = useState([]);
  const [teamViewType, setTeamViewType] = useState('summary'); // 'summary' | 'date' | 'month'

  // Inline editing state
  const [editingRowId, setEditingRowId] = useState(null);
  const [editingValues, setEditingValues] = useState({});
  const [savingRow, setSavingRow] = useState(false);

  const [loading, setLoading] = useState(false);
  const [triggerRefresh, setTriggerRefresh] = useState(false);

  // Inline editing functions
  const startEditing = (entry) => {
    setEditingRowId(entry.id);
    setEditingValues({
      calls: entry.calls || 0,
      files: entry.files || 0,
      is_leave: entry.is_leave || false,
      pb: entry.pb || 0,
      hr: entry.hr || 0,
      jk: entry.jk || 0,
      hp: entry.hp || 0,
      mp: entry.mp || 0,
      rj: entry.rj || 0,
      up: entry.up || 0,
      br: entry.br || 0,
      others: entry.others || 0
    });
  };

  const handleEditChange = (field, value) => {
    setEditingValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveEditedRow = async (entryId) => {
    setSavingRow(true);
    try {
      const { error } = await supabase
        .from('daily_entries')
        .update({
          calls: editingValues.calls,
          files: editingValues.files,
          is_leave: editingValues.is_leave,
          pb: editingValues.pb,
          hr: editingValues.hr,
          jk: editingValues.jk,
          hp: editingValues.hp,
          mp: editingValues.mp,
          rj: editingValues.rj,
          up: editingValues.up,
          br: editingValues.br,
          others: editingValues.others
        })
        .eq('id', entryId);

      if (error) throw error;
      setEditingRowId(null);
      setTriggerRefresh(prev => !prev);
      alert('Entry updated successfully!');
    } catch (err) {
      console.error('Error updating entry:', err);
      alert('Error updating entry: ' + err.message);
    } finally {
      setSavingRow(false);
    }
  };

  // Fetch agents on mount
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('*, teams(name)')
          .order('name');
        if (error) throw error;
        setAgents(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAgents();
  }, []);

  // Fetch performance based on filters
  useEffect(() => {
    if (!selectedAgent) return;

    const fetchPerformance = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('daily_entries')
          .select('*')
          .eq('agent_id', selectedAgent);

        if (filterType === 'single') {
          query = query.eq('date', selectedDate);
        } else if (filterType === 'range') {
          query = query.gte('date', startDate).lte('date', endDate);
        } else if (filterType === 'month') {
          const year = selectedMonth.split('-')[0];
          const month = selectedMonth.split('-')[1];
          const firstDay = `${selectedMonth}-01`;
          const lastDay = `${selectedMonth}-${new Date(year, month, 0).getDate()}`;
          query = query.gte('date', firstDay).lte('date', lastDay);
        }

        const { data, error } = await query.order('date', { ascending: false });
        if (error) throw error;
        setAgentEntries(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [selectedAgent, filterType, selectedDate, startDate, endDate, selectedMonth, triggerRefresh]);

  // Fetch Team performance summary
  useEffect(() => {
    if (activeTab !== 'team') return;

    const fetchTeamSummary = async () => {
      setLoading(true);
      try {
        // Compute date filter ranges
        let start, end;
        if (filterType === 'single') {
          start = selectedDate;
          end = selectedDate;
        } else if (filterType === 'range') {
          start = startDate;
          end = endDate;
        } else if (filterType === 'month') {
          const year = selectedMonth.split('-')[0];
          const month = selectedMonth.split('-')[1];
          start = `${selectedMonth}-01`;
          end = `${selectedMonth}-${new Date(year, month, 0).getDate()}`;
        }

        // Fetch entries joined with agents and teams
        const { data, error } = await supabase
          .from('daily_entries')
          .select('*, agents(*, teams(*))')
          .gte('date', start)
          .lte('date', end);

        if (error) throw error;

        // Group by Team Name
        const summaryMap = {};
        const dateSummaryMap = {};
        const monthSummaryMap = {};

        data.forEach(entry => {
          const teamName = entry.agents?.teams?.name || 'No Team';
          const entryDate = entry.date;
          const entryMonth = entryDate.substring(0, 7); // YYYY-MM
          
          let calls = entry.calls || 0;
          let files = entry.files || 0;
          let stateSums = 0;
          const states = {};
          stateColumns.forEach(st => {
            const key = st.toLowerCase();
            const val = entry[key] || 0;
            stateSums += val;
            states[key] = val;
          });

          // 1. Summary Map
          if (!summaryMap[teamName]) {
            summaryMap[teamName] = {
              name: teamName,
              totalCalls: 0,
              totalFiles: 0,
              totalEntries: 0,
              pb: 0, hr: 0, jk: 0, hp: 0, mp: 0, rj: 0, up: 0, br: 0, others: 0
            };
          }
          summaryMap[teamName].totalCalls += calls;
          summaryMap[teamName].totalFiles += files;
          summaryMap[teamName].totalEntries += stateSums;
          stateColumns.forEach(st => {
            summaryMap[teamName][st.toLowerCase()] += states[st.toLowerCase()];
          });

          // 2. Date Summary Map
          const dateKey = `${entryDate}_${teamName}`;
          if (!dateSummaryMap[dateKey]) {
            dateSummaryMap[dateKey] = {
              date: entryDate,
              teamName: teamName,
              calls: 0,
              files: 0,
              totalEntries: 0,
              pb: 0, hr: 0, jk: 0, hp: 0, mp: 0, rj: 0, up: 0, br: 0, others: 0
            };
          }
          dateSummaryMap[dateKey].calls += calls;
          dateSummaryMap[dateKey].files += files;
          dateSummaryMap[dateKey].totalEntries += stateSums;
          stateColumns.forEach(st => {
            dateSummaryMap[dateKey][st.toLowerCase()] += states[st.toLowerCase()];
          });

          // 3. Month Summary Map
          const monthKey = `${entryMonth}_${teamName}`;
          if (!monthSummaryMap[monthKey]) {
            monthSummaryMap[monthKey] = {
              month: entryMonth,
              teamName: teamName,
              calls: 0,
              files: 0,
              totalEntries: 0,
              pb: 0, hr: 0, jk: 0, hp: 0, mp: 0, rj: 0, up: 0, br: 0, others: 0
            };
          }
          monthSummaryMap[monthKey].calls += calls;
          monthSummaryMap[monthKey].files += files;
          monthSummaryMap[monthKey].totalEntries += stateSums;
          stateColumns.forEach(st => {
            monthSummaryMap[monthKey][st.toLowerCase()] += states[st.toLowerCase()];
          });
        });

        setTeamSummary(Object.values(summaryMap));
        
        const sortedDateSummary = Object.values(dateSummaryMap).sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return a.teamName.localeCompare(b.teamName);
        });
        setTeamDateSummary(sortedDateSummary);

        const sortedMonthSummary = Object.values(monthSummaryMap).sort((a, b) => {
          if (a.month !== b.month) return b.month.localeCompare(a.month);
          return a.teamName.localeCompare(b.teamName);
        });
        setTeamMonthSummary(sortedMonthSummary);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamSummary();
  }, [activeTab, filterType, selectedDate, startDate, endDate, selectedMonth, triggerRefresh]);

  // Aggregate stats
  const totals = agentEntries.reduce(
    (acc, curr) => {
      if (curr.is_leave) {
        acc.leaves += 1;
      } else {
        acc.calls += curr.calls;
        acc.files += curr.files;
        stateColumns.forEach(st => {
          acc.stateEntries += curr[st.toLowerCase()] || 0;
        });
        if (curr.calls > 0) acc.activeDays += 1;
      }
      return acc;
    },
    { calls: 0, files: 0, stateEntries: 0, activeDays: 0, leaves: 0 }
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Performance Reports</h1>
          <p style={{ color: 'var(--text-muted)' }}>Analyze agent and team-level metrics over time</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          className={`btn ${activeTab === 'agent' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('agent')}
        >
          <User size={16} style={{ marginRight: '0.5rem' }} /> Agent Performance
        </button>
        <button 
          className={`btn ${activeTab === 'team' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('team')}
        >
          <Users size={16} style={{ marginRight: '0.5rem' }} /> Team Performance
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>Filter Parameters</h3>
          <button 
            onClick={() => setTriggerRefresh(prev => !prev)} 
            disabled={loading}
            className="btn btn-secondary" 
            style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          
          {activeTab === 'agent' && (
            <div className="input-group" style={{ margin: 0, minWidth: '200px' }}>
              <label>Select Agent</label>
              <select 
                className="input-field" 
                value={selectedAgent} 
                onChange={(e) => setSelectedAgent(e.target.value)}
                style={{ backgroundColor: '#1a1d24' }}
              >
                <option value="">-- Choose Agent --</option>
                {agents.map(ag => (
                  <option key={ag.id} value={ag.id}>{ag.name} ({ag.teams?.name || 'No Team'})</option>
                ))}
              </select>
            </div>
          )}

          <div className="input-group" style={{ margin: 0, minWidth: '150px' }}>
            <label>Timeframe Type</label>
            <select 
              className="input-field" 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{ backgroundColor: '#1a1d24' }}
            >
              <option value="single">Single Date</option>
              <option value="range">Date Range</option>
              <option value="month">Monthly</option>
            </select>
          </div>

          {filterType === 'single' && (
            <div className="input-group" style={{ margin: 0 }}>
              <label>Date</label>
              <input 
                type="date" 
                className="input-field" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}

          {filterType === 'range' && (
            <>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Start Date</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label>End Date</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          {filterType === 'month' && (
            <div className="input-group" style={{ margin: 0 }}>
              <label>Month</label>
              <input 
                type="month" 
                className="input-field" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Fetching metrics from Supabase...</div>}

      {!loading && activeTab === 'agent' && (
        <div>
          {selectedAgent ? (
            <>
              {/* Performance Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Calls</span>
                  <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>{totals.calls}</h2>
                  <ArrowUpRight size={16} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'var(--primary)' }} />
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Files</span>
                  <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>{totals.files}</h2>
                  <ArrowUpRight size={16} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'var(--primary)' }} />
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Entries</span>
                  <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>{totals.stateEntries}</h2>
                  <ArrowUpRight size={16} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'var(--primary)' }} />
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Leaves</span>
                  <h2 style={{ fontSize: '2rem', marginTop: '0.5rem', color: 'var(--error)' }}>{totals.leaves}</h2>
                </div>
              </div>

              {/* Performance Log with Inline Editing */}
              <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Performance Log</h2>
              <div className="glass-panel data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Calls</th>
                      <th>Files</th>
                      <th>Entry</th>
                      {stateColumns.map(st => <th key={st}>{st}</th>)}
                      <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentEntries.length === 0 ? (
                      <tr>
                        <td colSpan={stateColumns.length + 5} style={{ textAlign: 'center', padding: '1.5rem' }}>
                          No records found for the selected parameters.
                        </td>
                      </tr>
                    ) : (
                      agentEntries.map(entry => {
                        const isEditing = editingRowId === entry.id;
                        return (
                          <tr key={entry.id} style={entry.is_leave && !isEditing ? { opacity: 0.5, backgroundColor: 'rgba(239, 68, 68, 0.05)' } : {}}>
                            <td>{entry.date}</td>
                            <td>
                              {isEditing ? (
                                <select 
                                  className="input-field"
                                  value={editingValues.is_leave ? 'leave' : 'active'}
                                  onChange={(e) => {
                                    const leaveVal = e.target.value === 'leave';
                                    handleEditChange('is_leave', leaveVal);
                                    if (leaveVal) {
                                      handleEditChange('calls', 0);
                                      handleEditChange('files', 0);
                                      stateColumns.forEach(st => handleEditChange(st.toLowerCase(), 0));
                                    }
                                  }}
                                  style={{ padding: '0.25rem', fontSize: '0.8rem', width: '90px' }}
                                >
                                  <option value="active">ACTIVE</option>
                                  <option value="leave">ON LEAVE</option>
                                </select>
                              ) : (
                                entry.is_leave ? (
                                  <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>ON LEAVE</span>
                                ) : (
                                  <span style={{ color: 'var(--primary)' }}>ACTIVE</span>
                                )
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input 
                                  type="number"
                                  className="input-field"
                                  value={editingValues.calls}
                                  onChange={(e) => handleEditChange('calls', parseInt(e.target.value) || 0)}
                                  disabled={editingValues.is_leave}
                                  style={{ width: '60px', padding: '0.25rem', textAlign: 'center' }}
                                />
                              ) : (
                                entry.calls
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input 
                                  type="number"
                                  className="input-field"
                                  value={editingValues.files}
                                  onChange={(e) => handleEditChange('files', parseInt(e.target.value) || 0)}
                                  disabled={editingValues.is_leave}
                                  style={{ width: '60px', padding: '0.25rem', textAlign: 'center' }}
                                />
                              ) : (
                                entry.files
                              )}
                            </td>
                            <td style={{ fontWeight: '600', color: 'var(--primary)' }}>
                              {isEditing ? (
                                stateColumns.reduce((sum, st) => sum + (editingValues[st.toLowerCase()] || 0), 0)
                              ) : (
                                stateColumns.reduce((sum, st) => sum + (entry[st.toLowerCase()] || 0), 0)
                              )}
                            </td>
                            {stateColumns.map(st => {
                              const key = st.toLowerCase();
                              return (
                                <td key={st}>
                                  {isEditing ? (
                                    <input 
                                      type="number"
                                      className="input-field"
                                      value={editingValues[key]}
                                      onChange={(e) => handleEditChange(key, parseInt(e.target.value) || 0)}
                                      disabled={editingValues.is_leave}
                                      style={{ width: '50px', padding: '0.25rem', textAlign: 'center' }}
                                    />
                                  ) : (
                                    entry[key] || 0
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'center' }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                  <button 
                                    className="btn btn-primary"
                                    onClick={() => saveEditedRow(entry.id)}
                                    disabled={savingRow}
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                  >
                                    Save
                                  </button>
                                  <button 
                                    className="btn btn-secondary"
                                    onClick={() => setEditingRowId(null)}
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  className="btn btn-secondary"
                                  onClick={() => startEditing(entry)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Please select an agent to see their performance details.
            </div>
          )}
        </div>
      )}
 
      {!loading && activeTab === 'team' && (
        <div>
          {/* Sub-tabs/Toggles for Team View Type */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <button 
              className={`btn ${teamViewType === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTeamViewType('summary')}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
            >
              Summary View
            </button>
            <button 
              className={`btn ${teamViewType === 'date' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTeamViewType('date')}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
            >
              Date-wise Breakdown
            </button>
            <button 
              className={`btn ${teamViewType === 'month' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTeamViewType('month')}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
            >
              Month-wise Breakdown
            </button>
          </div>

          <div className="glass-panel data-table-container">
            {teamViewType === 'summary' && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Team (Agency)</th>
                    <th>Total Calls</th>
                    <th>Total Files</th>
                    {stateColumns.map(st => <th key={st}>{st}</th>)}
                    <th>Total State Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {teamSummary.length === 0 ? (
                    <tr>
                      <td colSpan={stateColumns.length + 4} style={{ textAlign: 'center', padding: '1.5rem' }}>
                        No team records found for the selected timeframe.
                      </td>
                    </tr>
                  ) : (
                    teamSummary.map(team => (
                      <tr key={team.name}>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{team.name}</td>
                        <td>{team.totalCalls.toLocaleString()}</td>
                        <td>{team.totalFiles.toLocaleString()}</td>
                        {stateColumns.map(st => (
                          <td key={st}>{team[st.toLowerCase()].toLocaleString()}</td>
                        ))}
                        <td style={{ fontWeight: '600' }}>{team.totalEntries.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {teamViewType === 'date' && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Team (Agency)</th>
                    <th>Calls</th>
                    <th>Files</th>
                    {stateColumns.map(st => <th key={st}>{st}</th>)}
                    <th>Total State Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {teamDateSummary.length === 0 ? (
                    <tr>
                      <td colSpan={stateColumns.length + 5} style={{ textAlign: 'center', padding: '1.5rem' }}>
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    teamDateSummary.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)' }}>{row.date}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{row.teamName}</td>
                        <td>{row.calls.toLocaleString()}</td>
                        <td>{row.files.toLocaleString()}</td>
                        {stateColumns.map(st => (
                          <td key={st}>{row[st.toLowerCase()].toLocaleString()}</td>
                        ))}
                        <td style={{ fontWeight: '600' }}>{row.totalEntries.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {teamViewType === 'month' && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Team (Agency)</th>
                    <th>Calls</th>
                    <th>Files</th>
                    {stateColumns.map(st => <th key={st}>{st}</th>)}
                    <th>Total State Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMonthSummary.length === 0 ? (
                    <tr>
                      <td colSpan={stateColumns.length + 5} style={{ textAlign: 'center', padding: '1.5rem' }}>
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    teamMonthSummary.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)' }}>{row.month}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{row.teamName}</td>
                        <td>{row.calls.toLocaleString()}</td>
                        <td>{row.files.toLocaleString()}</td>
                        {stateColumns.map(st => (
                          <td key={st}>{row[st.toLowerCase()].toLocaleString()}</td>
                        ))}
                        <td style={{ fontWeight: '600' }}>{row.totalEntries.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Performance;
