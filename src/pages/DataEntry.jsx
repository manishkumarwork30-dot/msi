import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FileSpreadsheet, Save, Clipboard, RefreshCw } from 'lucide-react';

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

const DataEntry = () => {
  const [agentsList, setAgentsList] = useState([]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [gridData, setGridData] = useState({});
  const [saving, setSaving] = useState(false);
  const [monthlyTotals, setMonthlyTotals] = useState({ prev: {}, curr: {} });

  // Copy Paste Import State
  const [pastedData, setPastedData] = useState('');
  const [parseError, setParseError] = useState('');
  const [unmatchedAgents, setUnmatchedAgents] = useState([]);

  // Load agents
  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*, teams(name)')
        .order('name');
      if (error) throw error;
      setAgentsList(data || []);

      // Initialize Grid Data template
      const initialGrid = {};
      (data || []).forEach(agent => {
        initialGrid[agent.id] = {
          calls: 0,
          files: 0, // Calculated dynamically
          is_leave: false,
          pb: 0, hr: 0, jk: 0, hp: 0, mp: 0, rj: 0, up: 0, br: 0, others: 0
        };
      });
      setGridData(initialGrid);
    } catch (err) {
      console.error('Error fetching agents:', err);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  // Fetch existing entries for the selected date to populate the grid
  useEffect(() => {
    const fetchExistingEntries = async () => {
      if (agentsList.length === 0) return;
      try {
        const { data, error } = await supabase
          .from('daily_entries')
          .select('*')
          .eq('date', entryDate);
        
        if (error) throw error;

        // Fetch previous and current month totals for each agent
        const { prevStart, prevEnd, currentStart, currentEnd } = getMonthRanges(entryDate);
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
        setMonthlyTotals({ prev: prevMonthTotals, curr: currMonthTotals });

        // Reset grid to default template first
        const resetGrid = {};
        agentsList.forEach(agent => {
          resetGrid[agent.id] = {
            calls: 0,
            files: 0,
            is_leave: false,
            pb: 0, hr: 0, jk: 0, hp: 0, mp: 0, rj: 0, up: 0, br: 0, others: 0
          };
        });

        // Overlay existing database values
        if (data && data.length > 0) {
          data.forEach(entry => {
            if (resetGrid[entry.agent_id]) {
              resetGrid[entry.agent_id] = {
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
              };
            }
          });
        }
        setGridData(resetGrid);
      } catch (err) {
        console.error('Error fetching daily entries:', err);
      }
    };

    fetchExistingEntries();
  }, [entryDate, agentsList]);

  // Handle cell edits in the grid
  const handleCellChange = (agentId, field, value) => {
    setGridData(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [field]: value
      }
    }));
  };

  // Toggle Leave checkbox
  const handleLeaveToggle = (agentId, isChecked) => {
    setGridData(prev => {
      const updatedRow = { ...prev[agentId], is_leave: isChecked };
      if (isChecked) {
        updatedRow.calls = 0;
        updatedRow.files = 0;
        stateColumns.forEach(st => {
          updatedRow[st.toLowerCase()] = 0;
        });
      }
      return {
        ...prev,
        [agentId]: updatedRow
      };
    });
  };

  // Parse Copy-Pasted Excel Data
  const handleParsePaste = () => {
    setParseError('');
    setUnmatchedAgents([]);
    if (!pastedData.trim()) return;

    try {
      const rows = pastedData.split('\n').map(r => r.trim()).filter(r => r);
      const updatedGrid = { ...gridData };
      let matchCount = 0;
      const unmatched = [];

      rows.forEach((rowText, idx) => {
        const cols = rowText.split('\t').map(c => c.trim());
        
        // Skip headers
        if (idx === 0 && (cols[0].toLowerCase().includes('agent') || cols[0].toLowerCase().includes('name') || cols[0].toLowerCase().includes('call') || cols[0].toLowerCase().includes('file'))) {
          return;
        }

        const agentNameInput = cols[0];
        if (!agentNameInput) return;

        // Remove team suffix like " (UT)" or "(ARR)" or just parenthesis
        const cleanInputName = agentNameInput.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();

        // Find agent matches
        const matchedAgent = agentsList.find(a => {
          const cleanAgentName = a.name.trim().toLowerCase();
          return cleanAgentName === cleanInputName || 
                 cleanAgentName.includes(cleanInputName) || 
                 cleanInputName.includes(cleanAgentName);
        });

        if (matchedAgent) {
          const calls = parseInt(cols[1]) || 0;
          const is_leave = cols[12]?.toLowerCase() === 'true' || cols[12] === '1';

          const stateValues = {};
          let stateSum = 0;
          stateColumns.forEach((st, sIdx) => {
            const val = parseInt(cols[3 + sIdx]) || 0;
            stateValues[st.toLowerCase()] = val;
            stateSum += val;
          });

          updatedGrid[matchedAgent.id] = {
            calls,
            files: stateSum, // Calculate files as sum of states
            is_leave,
            ...stateValues
          };
          matchCount++;
        } else {
          unmatched.push(agentNameInput);
        }
      });

      setGridData(updatedGrid);
      if (unmatched.length > 0) {
        setUnmatchedAgents(unmatched);
        alert(`Pasted data parsed. Loaded values for ${matchCount} agents. Warning: ${unmatched.length} agents could not be matched.`);
      } else {
        alert(`Pasted data parsed successfully! Loaded values for ${matchCount} agents. Please double check and edit below.`);
      }
      setPastedData('');
    } catch (err) {
      setParseError('Failed to parse. Copy columns directly from a spreadsheet.');
      console.error(err);
    }
  };

  // Save reviewed grid to Supabase
  const handleSaveGrid = async () => {
    setSaving(true);
    try {
      const entries = Object.keys(gridData).map(agentId => {
        const row = gridData[agentId];
        // Calculate files as the sum of all states
        const calculatedFiles = stateColumns.reduce((sum, st) => sum + (row[st.toLowerCase()] || 0), 0);
        return {
          agent_id: agentId,
          date: entryDate,
          calls: row.calls,
          files: calculatedFiles, // calculated sum
          is_leave: row.is_leave,
          pb: row.pb,
          hr: row.hr,
          jk: row.jk,
          hp: row.hp,
          mp: row.mp,
          rj: row.rj,
          up: row.up,
          br: row.br,
          others: row.others
        };
      });

      const { error } = await supabase
        .from('daily_entries')
        .upsert(entries, { onConflict: 'agent_id,date' });

      if (error) throw error;

      alert(`Successfully saved all records to Supabase for ${entryDate}!`);
    } catch (err) {
      console.error(err);
      alert("Error saving records: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Insert Data</h1>
          <p style={{ color: 'var(--text-muted)' }}>Paste from Excel, double check values, and save to database</p>
        </div>
        <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--primary-low, var(--border-color))' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--primary)' }}>Target Entry Date:</label>
          <input 
            type="date" 
            className="input-field" 
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            style={{ margin: 0, padding: '0.4rem 0.75rem', backgroundColor: '#1a1d24', border: '1px solid var(--border-color)', borderRadius: '6px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Step 1: Copy-Paste Section */}
        <div className="glass-panel" style={{ padding: '1.5rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            <Clipboard size={20} color="var(--primary)" /> 
            Step 1: Excel Copy-Paste for {entryDate}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Copy your rows from Excel or Google Sheets, paste them here, and click Parse. Values will be loaded below for review.
            <br />
            <span style={{ color: 'var(--text-main)' }}>Columns: Agent | Calls | Files | PB | HR | JK | HP | MP | RJ | UP | BR | Others | Leave</span>
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <textarea 
              className="input-field" 
              placeholder="Paste spreadsheet columns here..."
              style={{ flex: 1, minHeight: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
            />
            <button 
              className="btn btn-secondary" 
              onClick={handleParsePaste}
              style={{ alignSelf: 'flex-end', display: 'flex', gap: '0.5rem', alignItems: 'center', height: 'fit-content' }}
            >
              <RefreshCw size={16} /> Parse & Load
            </button>
          </div>
          {parseError && <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{parseError}</div>}
          
          {unmatchedAgents.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px' }}>
              <strong style={{ color: 'var(--error)', fontSize: '0.9rem' }}>⚠️ Warning: The following agents from paste could not be matched:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {unmatchedAgents.map((name, i) => (
                  <span key={i} style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', color: '#f87171' }}>
                    {name}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: 0 }}>
                Please check the spelling in your excel sheet or add these agents in the Admin Settings tab.
              </p>
            </div>
          )}
        </div>

        {/* Step 2: Grid & Save Section */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <FileSpreadsheet size={20} color="var(--primary)" />
              Step 2: Double Check Grid & Save
            </h3>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                onClick={loadAgents} 
                className="btn btn-secondary" 
                style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Reload Agents/Entries"
              >
                <RefreshCw size={16} />
              </button>
              <input 
                type="date" 
                className="input-field" 
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                style={{ margin: 0, padding: '0.5rem' }}
              />
              <button 
                className="btn btn-primary" 
                onClick={handleSaveGrid} 
                disabled={saving}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save All'}
              </button>
            </div>
          </div>

          {agentsList.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No agents registered. Please go to Admin Settings to register teams and agents first.
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '150px' }}>Agent (Team)</th>
                    <th>Leave?</th>
                    <th>Calls</th>
                    <th>File (Sum)</th>
                    <th>Prev Month</th>
                    <th>Curr Month</th>
                    {stateColumns.map(st => <th key={st}>{st}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {agentsList.map(agent => {
                    const row = gridData[agent.id] || {};
                    const calculatedFiles = stateColumns.reduce((sum, st) => sum + (row[st.toLowerCase()] || 0), 0);
                    return (
                      <tr key={agent.id} style={row.is_leave ? { backgroundColor: 'rgba(239, 68, 68, 0.05)', opacity: 0.6 } : {}}>
                        <td style={{ fontWeight: '500' }}>
                          {agent.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({agent.teams?.name || 'No Team'})</span>
                        </td>
                        <td>
                          <input 
                            type="checkbox" 
                            checked={row.is_leave || false}
                            onChange={(e) => handleLeaveToggle(agent.id, e.target.checked)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <input 
                            type="number"
                            className="input-field"
                            style={{ width: '70px', padding: '0.25rem', textAlign: 'center' }}
                            value={row.calls || 0}
                            onChange={(e) => handleCellChange(agent.id, 'calls', parseInt(e.target.value) || 0)}
                            disabled={row.is_leave}
                          />
                        </td>
                        <td style={{ fontWeight: '600', color: 'var(--text-main)', textAlign: 'center', verticalAlign: 'middle' }}>
                          {calculatedFiles}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          {monthlyTotals.prev[agent.id] || 0}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          {monthlyTotals.curr[agent.id] || 0}
                        </td>
                        {stateColumns.map(st => {
                          const key = st.toLowerCase();
                          return (
                            <td key={st}>
                              <input 
                                type="number"
                                className="input-field"
                                style={{ width: '55px', padding: '0.25rem', textAlign: 'center' }}
                                value={row[key] || 0}
                                onChange={(e) => handleCellChange(agent.id, key, parseInt(e.target.value) || 0)}
                                disabled={row.is_leave}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DataEntry;
