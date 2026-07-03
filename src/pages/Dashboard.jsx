import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, RefreshCw } from 'lucide-react';

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const stateColumns = ['PB', 'HR', 'JK', 'HP', 'MP', 'RJ', 'UP', 'BR', 'OTHERS'];

  const fetchDashboardData = async (date) => {
    setLoading(true);
    try {
      // Query from Supabase: Join with agent and team details
      const { data: dbData, error } = await supabase
        .from('daily_entries')
        .select(`
          *,
          agents (
            name,
            teams (
              name
            )
          )
        `)
        .eq('date', date);

      if (error) throw error;

      // Map Supabase rows to table structure
      const formatted = (dbData || []).map(entry => ({
        team: entry.agents?.teams?.name || 'No Team',
        agent: entry.agents?.name || 'Unknown Agent',
        is_leave: entry.is_leave,
        calls: entry.calls,
        files: entry.files,
        pb: entry.pb,
        hr: entry.hr,
        jk: entry.jk,
        hp: entry.hp,
        mp: entry.mp,
        rj: entry.rj,
        up: entry.up,
        br: entry.br,
        others: entry.others
      }));

      setData(formatted);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedDate);
  }, [selectedDate]);

  // Group data by team
  const groupedData = data.reduce((acc, curr) => {
    if (!acc[curr.team]) acc[curr.team] = [];
    acc[curr.team].push(curr);
    return acc;
  }, {});

  const getTeamTotals = (teamData) => {
    return teamData.reduce((acc, curr) => {
      acc.calls += curr.calls;
      acc.files += curr.files;
      stateColumns.forEach(st => acc[st.toLowerCase()] += curr[st.toLowerCase()] || 0);
      return acc;
    }, { calls: 0, files: 0, pb: 0, hr: 0, jk: 0, hp: 0, mp: 0, rj: 0, up: 0, br: 0, others: 0 });
  };

  // Grand Total calculation
  const getGrandTotal = () => {
    return data.reduce((acc, curr) => {
      acc.calls += curr.calls;
      acc.files += curr.files;
      stateColumns.forEach(st => acc[st.toLowerCase()] += curr[st.toLowerCase()] || 0);
      return acc;
    }, { calls: 0, files: 0, pb: 0, hr: 0, jk: 0, hp: 0, mp: 0, rj: 0, up: 0, br: 0, others: 0 });
  };

  const grandTotals = getGrandTotal();

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Overview of agent calls and entries</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={() => fetchDashboardData(selectedDate)} 
            disabled={loading}
            className="btn btn-secondary" 
            style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refresh Data"
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
          <div className="date-picker-wrapper glass-panel" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}>
            <Calendar size={20} color="var(--primary)" />
            <input 
              type="date" 
              value={selectedDate}
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
        </div>
      </div>

      <div className="glass-panel data-table-container">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading data from Supabase...</div>
        ) : data.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No data records saved for this date. Go to Admin settings to input some entries!
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>AGENT</th>
                <th>CALLS</th>
                <th>FILE</th>
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
                  teamName === 'UT' ? { backgroundColor: 'rgba(234, 179, 8, 0.1)' } : 
                  teamName === 'ARR' ? { backgroundColor: 'rgba(249, 115, 22, 0.1)' } : 
                  teamName === 'IND' ? { backgroundColor: 'rgba(34, 197, 94, 0.1)' } : 
                  teamName === 'MS2' ? { backgroundColor: 'rgba(56, 189, 248, 0.1)' } :
                  { backgroundColor: 'rgba(255, 255, 255, 0.02)' };

                return (
                  <React.Fragment key={teamName}>
                    {teamRows.map((row, idx) => (
                      <tr key={idx} style={row.is_leave ? { ...rowStyle, opacity: 0.5 } : rowStyle}>
                        <td>
                          {row.agent} {row.is_leave && <span style={{ color: 'var(--error)', fontSize: '0.75rem', fontWeight: 'bold' }}>(LEAVE)</span>}
                        </td>
                        <td>{row.calls}</td>
                        <td>{row.files}</td>
                        {stateColumns.map(st => (
                          <td key={st}>{row[st.toLowerCase()] || 0}</td>
                        ))}
                      </tr>
                    ))}
                    {/* Team Total Row */}
                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', fontWeight: 'bold' }}>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{teamName} Total:</td>
                      <td>{totals.calls}</td>
                      <td>{totals.files}</td>
                      {stateColumns.map(st => (
                        <td key={st}>{totals[st.toLowerCase()] || 0}</td>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              })}
              {/* Grand Total Row */}
              <tr style={{ backgroundColor: 'rgba(74, 222, 128, 0.15)', fontWeight: 'bold', borderTop: '2px solid var(--primary)' }}>
                <td style={{ textAlign: 'right', color: 'var(--primary)' }}>GRAND TOTAL:</td>
                <td>{grandTotals.calls}</td>
                <td>{grandTotals.files}</td>
                {stateColumns.map(st => (
                  <td key={st}>{grandTotals[st.toLowerCase()] || 0}</td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
