import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, RefreshCw, Edit2, Check, X, Share2 } from 'lucide-react';

const stateColumns = ['PB', 'HR', 'JK', 'HP', 'MP', 'RJ', 'UP', 'BR', 'OTHERS'];

const getMonthRanges = (dateStr) => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  // Current Month
  const curStart = new Date(year, month, 1);
  const curEnd = new Date(year, month + 1, 0);

  // Previous Month
  const prevStart = new Date(year, month - 1, 1);
  const prevEnd = new Date(year, month, 0);

  // Format to YYYY-MM-DD
  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    currentStart: formatDate(curStart),
    currentEnd: formatDate(curEnd),
    prevStart: formatDate(prevStart),
    prevEnd: formatDate(prevEnd)
  };
};

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState([]);
  const [ivrCalls, setIvrCalls] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDashboardData = useCallback(async (date) => {
    setLoading(true);
    try {
      // 1. Fetch all agents
      const { data: agents, error: agentsErr } = await supabase
        .from('agents')
        .select('id, name, teams(name)')
        .order('name');
      if (agentsErr) throw agentsErr;

      // 2. Fetch entries for the selected date
      const { data: dbData, error: dbErr } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('date', date);
      if (dbErr) throw dbErr;

      const entryMap = {};
      (dbData || []).forEach(e => {
        entryMap[e.agent_id] = e;
      });

      // Fetch previous and current month totals for each agent
      const { prevStart, prevEnd, currentStart, currentEnd } = getMonthRanges(date);
      const { data: monthlyData, error: monthlyErr } = await supabase
        .from('daily_entries')
        .select('agent_id, date, pb, hr, jk, hp, mp, rj, up, br, others')
        .gte('date', prevStart)
        .lte('date', currentEnd);

      if (monthlyErr) throw monthlyErr;

      const prevMonthTotals = {};
      const currMonthTotals = {};
      (monthlyData || []).forEach(row => {
        const agentId = row.agent_id;
        const rowDate = row.date;
        const fileSum = (row.pb || 0) + (row.hr || 0) + (row.jk || 0) + (row.hp || 0) + (row.mp || 0) + (row.rj || 0) + (row.up || 0) + (row.br || 0) + (row.others || 0);

        if (rowDate >= currentStart && rowDate <= currentEnd) {
          currMonthTotals[agentId] = (currMonthTotals[agentId] || 0) + fileSum;
        } else if (rowDate >= prevStart && rowDate <= prevEnd) {
          prevMonthTotals[agentId] = (prevMonthTotals[agentId] || 0) + fileSum;
        }
      });

      // 3. Map Supabase rows to table structure, showing all agents
      const formatted = (agents || []).map(agent => {
        const entry = entryMap[agent.id] || {};
        return {
          agentId: agent.id,
          team: agent.teams?.name || 'No Team',
          agent: agent.name || 'Unknown Agent',
          is_leave: entry.is_leave || false,
          calls: entry.calls || 0,
          pb: entry.pb || 0,
          hr: entry.hr || 0,
          jk: entry.jk || 0,
          hp: entry.hp || 0,
          mp: entry.mp || 0,
          rj: entry.rj || 0,
          up: entry.up || 0,
          br: entry.br || 0,
          others: entry.others || 0,
          id: entry.id || null,
          prevMonthFiles: prevMonthTotals[agent.id] || 0,
          currMonthFiles: currMonthTotals[agent.id] || 0
        };
      });

      setData(formatted);

      // 4. Fetch daily summary totals (IVR Calls only)
      const { data: summaryData, error: summaryErr } = await supabase
        .from('daily_summary')
        .select('*')
        .eq('date', date)
        .maybeSingle();

      if (summaryErr) throw summaryErr;

      if (summaryData) {
        setIvrCalls(summaryData.ivr_calls || 0);
      } else {
        setIvrCalls(0);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(selectedDate);
  }, [selectedDate, fetchDashboardData]);

  // Group data by team
  const groupedData = data.reduce((acc, curr) => {
    if (!acc[curr.team]) acc[curr.team] = [];
    acc[curr.team].push(curr);
    return acc;
  }, {});

  const getTeamTotals = (teamData) => {
    return teamData.reduce((acc, curr) => {
      acc.calls += curr.calls;
      acc.prevMonthFiles += curr.prevMonthFiles || 0;
      acc.currMonthFiles += curr.currMonthFiles || 0;
      
      let teamStatesSum = 0;
      stateColumns.forEach(st => {
        const val = curr[st.toLowerCase()] || 0;
        acc[st.toLowerCase()] += val;
        teamStatesSum += val;
      });
      acc.files += teamStatesSum; // FILE is calculated as the sum of states
      
      return acc;
    }, { calls: 0, files: 0, prevMonthFiles: 0, currMonthFiles: 0, pb: 0, hr: 0, jk: 0, hp: 0, mp: 0, rj: 0, up: 0, br: 0, others: 0 });
  };

  // Grand Total calculation
  const getGrandTotal = () => {
    return data.reduce((acc, curr) => {
      acc.calls += curr.calls;
      acc.prevMonthFiles += curr.prevMonthFiles || 0;
      acc.currMonthFiles += curr.currMonthFiles || 0;
      
      let statesSum = 0;
      stateColumns.forEach(st => {
        const val = curr[st.toLowerCase()] || 0;
        acc[st.toLowerCase()] += val;
        statesSum += val;
      });
      acc.files += statesSum; // FILE is calculated as the sum of states
      
      return acc;
    }, { calls: 0, files: 0, prevMonthFiles: 0, currMonthFiles: 0, pb: 0, hr: 0, jk: 0, hp: 0, mp: 0, rj: 0, up: 0, br: 0, others: 0 });
  };

  const grandTotals = getGrandTotal();

  // Cell edit handler
  const handleCellEdit = (agentId, field, value) => {
    setData(prevData => prevData.map(row => {
      if (row.agentId === agentId) {
        const updatedRow = { ...row, [field]: value };
        if (field === 'is_leave' && value === true) {
          // Reset values if on leave
          updatedRow.calls = 0;
          stateColumns.forEach(st => updatedRow[st.toLowerCase()] = 0);
        }
        return updatedRow;
      }
      return row;
    }));
  };

  // Save changes handler
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      // 1. Save agent entries
      const entries = data.map(row => {
        const pb = parseInt(row.pb) || 0;
        const hr = parseInt(row.hr) || 0;
        const jk = parseInt(row.jk) || 0;
        const hp = parseInt(row.hp) || 0;
        const mp = parseInt(row.mp) || 0;
        const rj = parseInt(row.rj) || 0;
        const up = parseInt(row.up) || 0;
        const br = parseInt(row.br) || 0;
        const others = parseInt(row.others) || 0;
        const calculatedFiles = pb + hr + jk + hp + mp + rj + up + br + others;

        return {
          agent_id: row.agentId,
          date: selectedDate,
          calls: parseInt(row.calls) || 0,
          files: calculatedFiles, // calculated sum
          is_leave: !!row.is_leave,
          pb,
          hr,
          jk,
          hp,
          mp,
          rj,
          up,
          br,
          others
        };
      });

      const { error: entriesErr } = await supabase
        .from('daily_entries')
        .upsert(entries, { onConflict: 'agent_id,date' });

      if (entriesErr) throw entriesErr;

      // 2. Save overall summary (IVR Calls)
      const { error: summaryErr } = await supabase
        .from('daily_summary')
        .upsert({
          date: selectedDate,
          ivr_calls: parseInt(ivrCalls) || 0
        });

      if (summaryErr) throw summaryErr;

      alert('All changes saved successfully!');
      setIsEditMode(false);
      fetchDashboardData(selectedDate);
    } catch (err) {
      console.error('Error saving dashboard edits:', err);
      alert('Failed to save changes: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Copy structured report to clipboard for sharing
  const copyReportToClipboard = () => {
    const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    let text = `*FINAL STATUS - ${formattedDate}*\n\n`;

    Object.keys(groupedData).forEach(teamName => {
      text += `*${teamName}*\n`;
      const teamRows = groupedData[teamName];
      teamRows.forEach(row => {
        if (row.is_leave) {
          text += `- ${row.agent}: (LEAVE)\n`;
        } else {
          const stateParts = [];
          stateColumns.forEach(st => {
            const val = row[st.toLowerCase()] || 0;
            if (val > 0) {
              stateParts.push(`${st}:${val}`);
            }
          });
          const statesStr = stateParts.length > 0 ? ` (${stateParts.join(', ')})` : '';
          const calculatedFiles = stateColumns.reduce((sum, st) => sum + (row[st.toLowerCase()] || 0), 0);
          text += `- ${row.agent}: ${row.calls} C | ${calculatedFiles} F${statesStr}\n`;
        }
      });
      const totals = getTeamTotals(teamRows);
      text += `*${teamName} TOTAL*: ${totals.calls} Calls | ${totals.files} Files\n\n`;
    });

    const grand = getGrandTotal();
    const finalTotalCalls = grand.calls + ivrCalls;

    text += `*GRAND TOTAL*: ${grand.calls} Calls | ${grand.files} Files\n`;
    text += `*IVR CALLS*: ${ivrCalls}\n`;
    text += `*TOTAL CALLS (WITH IVR)*: ${finalTotalCalls}`;

    navigator.clipboard.writeText(text);
    alert('Report copied to clipboard! You can now paste and share it on WhatsApp/Teams.');
  };

  const finalTotalCalls = grandTotals.calls + ivrCalls;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Overview and management of agent calls and daily metrics</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={() => fetchDashboardData(selectedDate)} 
            disabled={loading || isEditMode}
            className="btn btn-secondary" 
            style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refresh Data"
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>

          <div className="date-picker-wrapper glass-panel" style={{ padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} color="var(--primary)" />
            <input 
              type="date" 
              value={selectedDate}
              disabled={isEditMode}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          <button 
            onClick={copyReportToClipboard}
            disabled={data.length === 0 || isEditMode}
            className="btn btn-secondary"
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <Share2 size={16} /> Share Result
          </button>

          {!isEditMode ? (
            <button 
              onClick={() => setIsEditMode(true)}
              disabled={data.length === 0}
              className="btn btn-primary"
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              <Edit2 size={16} /> Edit Data
            </button>
          ) : (
            <>
              <button 
                onClick={handleSaveChanges}
                disabled={saving}
                className="btn btn-primary"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#22c55e' }}
              >
                <Check size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                onClick={() => {
                  setIsEditMode(false);
                  fetchDashboardData(selectedDate);
                }}
                disabled={saving}
                className="btn btn-secondary"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
              >
                <X size={16} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="glass-panel data-table-container" style={{ position: 'relative' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading data...</div>
        ) : data.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No agents registered. Please go to Admin Settings to register teams and agents first.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: '160px' }}>AGENT</th>
                <th>CALLS</th>
                <th>FILE</th>
                <th>PREV MONTH</th>
                <th>CURR MONTH</th>
                {stateColumns.map(state => (
                  <th key={state}>{state}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(groupedData).map(teamName => {
                const teamRows = groupedData[teamName];
                const totals = getTeamTotals(teamRows);
                
                // Colors corresponding to teams
                const rowStyle = 
                  teamName === 'UT' ? { backgroundColor: 'rgba(234, 179, 8, 0.05)' } : 
                  teamName === 'ARR' ? { backgroundColor: 'rgba(249, 115, 22, 0.05)' } : 
                  teamName === 'IND' ? { backgroundColor: 'rgba(34, 197, 94, 0.05)' } : 
                  teamName === 'MS2' ? { backgroundColor: 'rgba(56, 189, 248, 0.05)' } :
                  { backgroundColor: 'rgba(255, 255, 255, 0.01)' };

                  return (
                    <React.Fragment key={teamName}>
                      {teamRows.map((row, idx) => {
                        const calculatedFiles = stateColumns.reduce((sum, st) => sum + (row[st.toLowerCase()] || 0), 0);
                        return (
                          <tr key={idx} className={`row-team-${teamName.toLowerCase()} ${row.is_leave && !isEditMode ? 'row-leave' : ''}`}>
                            <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '45px' }}>
                              {isEditMode ? (
                                <>
                                  <input 
                                    type="checkbox" 
                                    checked={row.is_leave} 
                                    onChange={(e) => handleCellEdit(row.agentId, 'is_leave', e.target.checked)} 
                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                  />
                                  <span style={{ textDecoration: row.is_leave ? 'line-through' : 'none' }}>
                                    {row.agent} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'normal' }}>({row.team})</span>
                                  </span>
                                  {row.is_leave && <span style={{ color: 'var(--error)', fontSize: '0.7rem', fontWeight: 'bold' }}>(LEAVE)</span>}
                                </>
                              ) : (
                                <>
                                  <span>
                                    {row.agent} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'normal' }}>({row.team})</span>
                                  </span>
                                  {row.is_leave && <span style={{ color: 'var(--error)', fontSize: '0.75rem', fontWeight: 'bold' }}>(LEAVE)</span>}
                                </>
                              )}
                            </td>
                            <td>
                              {isEditMode ? (
                                <input 
                                  type="number" 
                                  value={row.calls} 
                                  disabled={row.is_leave}
                                  onChange={(e) => handleCellEdit(row.agentId, 'calls', parseInt(e.target.value) || 0)} 
                                  className="input-field" 
                                  style={{ width: '65px', margin: 0, padding: '0.2rem', textAlign: 'center' }} 
                                />
                              ) : (
                                row.calls
                              )}
                            </td>
                            <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                              {calculatedFiles}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                              {row.prevMonthFiles}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                              {row.currMonthFiles}
                            </td>
                            {stateColumns.map(st => {
                              const val = row[st.toLowerCase()];
                              return (
                                <td key={st}>
                                  {isEditMode ? (
                                    <input 
                                      type="number" 
                                      value={val} 
                                      disabled={row.is_leave}
                                      onChange={(e) => handleCellEdit(row.agentId, st.toLowerCase(), parseInt(e.target.value) || 0)} 
                                      className="input-field" 
                                      style={{ width: '50px', margin: 0, padding: '0.2rem', textAlign: 'center' }} 
                                    />
                                  ) : (
                                    val || 0
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      {/* Team Total Row */}
                      <tr className="row-team-total">
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{teamName} Total:</td>
                        <td>{totals.calls}</td>
                        <td>{totals.files}</td>
                        <td>{totals.prevMonthFiles}</td>
                        <td>{totals.currMonthFiles}</td>
                        {stateColumns.map(st => (
                          <td key={st}>{totals[st.toLowerCase()] || 0}</td>
                        ))}
                      </tr>
                    </React.Fragment>
                  );
                })}
  
                {/* Grand Total Row */}
                <tr className="row-grand-total">
                  <td style={{ textAlign: 'right', color: 'var(--primary)' }}>GRAND TOTAL:</td>
                  <td>{grandTotals.calls}</td>
                  <td>{grandTotals.files}</td>
                  <td>{grandTotals.prevMonthFiles}</td>
                  <td>{grandTotals.currMonthFiles}</td>
                  {stateColumns.map(st => (
                    <td key={st}>{grandTotals[st.toLowerCase()] || 0}</td>
                  ))}
                </tr>
  
                {/* IVR Calls Row */}
                <tr className="row-ivr-calls">
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>IVR CALLS:</td>
                  <td colSpan={3 + stateColumns.length}>
                    {isEditMode ? (
                      <input 
                        type="number" 
                        value={ivrCalls} 
                        onChange={(e) => setIvrCalls(parseInt(e.target.value) || 0)} 
                        className="input-field" 
                        style={{ width: '100px', margin: 0, padding: '0.2rem', textAlign: 'center' }} 
                      />
                    ) : (
                      ivrCalls
                    )}
                  </td>
                  <td />
                </tr>
  
                {/* Total Calls + IVR Row */}
                <tr className="row-total-calls">
                  <td style={{ textAlign: 'right', color: 'var(--primary)' }}>TOTAL CALLS (WITH IVR):</td>
                  <td colSpan={1 + stateColumns.length} style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>
                    {finalTotalCalls}
                  </td>
                  <td />
                </tr>

            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
