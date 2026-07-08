import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, Filter, Trash2, Search, ArrowUpDown, ChevronLeft, ChevronRight, FileSpreadsheet, ShieldAlert, Award, Database, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const REQUIRED_COLUMNS = [
  'Src',
  'call_start_time_in',
  'duration_in',
  'duration_out',
  'call_status_out',
  'outgoing_picked',
  'calllevel_department',
  'agent_name'
];

const AuditAgent = () => {
  const [rawData, setRawData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Syncing states
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [unmatchedAgentsList, setUnmatchedAgentsList] = useState([]);

  // Filtering states
  const [selectedAgent, setSelectedAgent] = useState('All');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Sorting state
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [expandedAgents, setExpandedAgents] = useState({});

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    setLoading(true);
    setErrorMsg('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (json.length === 0) {
          throw new Error('The uploaded file is empty.');
        }

        // Map column names to trim whitespaces/ensure matching
        const normalizedData = json.map(row => {
          const newRow = {};
          Object.keys(row).forEach(key => {
            newRow[key.trim()] = row[key];
          });
          return newRow;
        });

        // Filter columns to keep only the ones we need
        const cleaned = normalizedData.map(row => {
          const filteredRow = {};
          REQUIRED_COLUMNS.forEach(col => {
            filteredRow[col] = row[col] !== undefined ? row[col] : '';
          });
          return filteredRow;
        });

        setRawData(cleaned);
        setCurrentPage(1);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to parse file. Please ensure it is a valid Excel or CSV file. Details: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('Error reading file.');
      setLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  const clearData = () => {
    setRawData([]);
    setFileName('');
    setSelectedAgent('All');
    setSelectedDepartment('All');
    setSelectedStatus('All');
    setSearchQuery('');
    setCurrentPage(1);
    setSyncStatus(null);
    setUnmatchedAgentsList([]);
  };

  // Date-wise Agent Calls Aggregation
  const dateWiseAgentCalls = useMemo(() => {
    if (rawData.length === 0) return [];
    
    const performanceMap = {};
    rawData.forEach(row => {
      const agentName = (row.agent_name || '').toString().trim() || 'Unknown Agent';
      const callStartTimeStr = row.call_start_time_in;
      if (!callStartTimeStr) return;
      
      const parsed = new Date(callStartTimeStr);
      if (isNaN(parsed.getTime())) return;
      
      // Get local YYYY-MM-DD
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const key = `${agentName}_${dateStr}`;
      if (!performanceMap[key]) {
        performanceMap[key] = {
          agent_name: agentName,
          date: dateStr,
          calls: 0
        };
      }
      performanceMap[key].calls += 1;
    });
    
    return Object.values(performanceMap);
  }, [rawData]);

  // Database Sync Handler
  const handleSyncToDatabase = async () => {
    if (dateWiseAgentCalls.length === 0) return;
    setSyncing(true);
    setSyncStatus(null);
    setUnmatchedAgentsList([]);

    try {
      // 1. Fetch all agents to map agent_name -> agent_id
      const { data: dbAgents, error: agentsError } = await supabase
        .from('agents')
        .select('id, name');

      if (agentsError) throw agentsError;

      const agentMap = {};
      dbAgents.forEach(a => {
        const cleanName = a.name.trim().toLowerCase().replace(/\s*\(.*?\)\s*/g, '');
        agentMap[cleanName] = a.id;
      });

      const matchedEntriesMap = {};
      const unmatched = new Set();
      const uniqueAgentIds = new Set();
      const uniqueDates = new Set();

      dateWiseAgentCalls.forEach(item => {
        const cleanExcelName = item.agent_name.trim().toLowerCase().replace(/\s*\(.*?\)\s*/g, '');
        let agentId = agentMap[cleanExcelName];
        
        if (!agentId) {
          const foundKey = Object.keys(agentMap).find(key => 
            key.includes(cleanExcelName) || cleanExcelName.includes(key)
          );
          if (foundKey) {
            agentId = agentMap[foundKey];
          }
        }

        if (agentId) {
          const key = `${agentId}_${item.date}`;
          if (matchedEntriesMap[key]) {
            matchedEntriesMap[key].calls += item.calls;
          } else {
            matchedEntriesMap[key] = {
              agent_id: agentId,
              date: item.date,
              calls: item.calls
            };
          }
          uniqueAgentIds.add(agentId);
          uniqueDates.add(item.date);
        } else {
          unmatched.add(item.agent_name);
        }
      });

      const matchedEntries = Object.values(matchedEntriesMap);

      if (unmatched.size > 0) {
        setUnmatchedAgentsList(Array.from(unmatched));
      }

      if (matchedEntries.length === 0) {
        setSyncStatus({
          type: 'error',
          message: 'No agent calls could be matched with agents in the database.'
        });
        setSyncing(false);
        return;
      }

      const agentIdsArray = Array.from(uniqueAgentIds);
      const datesArray = Array.from(uniqueDates);

      // Fetch existing daily entries for these agents and dates to merge data and avoid overwriting other fields
      const { data: existingEntries, error: entriesError } = await supabase
        .from('daily_entries')
        .select('*')
        .in('agent_id', agentIdsArray)
        .in('date', datesArray);

      if (entriesError) throw entriesError;

      const existingMap = {};
      (existingEntries || []).forEach(entry => {
        existingMap[`${entry.agent_id}_${entry.date}`] = entry;
      });

      const finalEntriesToUpsert = matchedEntries.map(item => {
        const key = `${item.agent_id}_${item.date}`;
        const existing = existingMap[key];

        if (existing) {
          const { id, created_at, ...rest } = existing;
          return {
            ...rest,
            calls: item.calls
          };
        } else {
          return {
            agent_id: item.agent_id,
            date: item.date,
            calls: item.calls,
            files: 0,
            entry: 0,
            is_leave: false,
            pb: 0, hr: 0, jk: 0, hp: 0, mp: 0, rj: 0, up: 0, br: 0, others: 0
          };
        }
      });

      const { error: upsertError } = await supabase
        .from('daily_entries')
        .upsert(finalEntriesToUpsert, { onConflict: 'agent_id,date' });

      if (upsertError) throw upsertError;

      setSyncStatus({
        type: unmatched.size > 0 ? 'warning' : 'success',
        message: `Successfully sync'ed ${finalEntriesToUpsert.length} records. ${unmatched.size > 0 ? `${unmatched.size} agent names from Excel could not be matched.` : ''}`
      });

    } catch (err) {
      console.error(err);
      setSyncStatus({
        type: 'error',
        message: 'Failed to sync with database: ' + err.message
      });
    } finally {
      setSyncing(false);
    }
  };

  // Helper parser for durations
  const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const formatDuration = (seconds) => {
    if (isNaN(seconds) || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Agent Performance Calculations
  const agentPerformance = useMemo(() => {
    if (rawData.length === 0) return [];

    const performanceMap = {};

    rawData.forEach(row => {
      const agent = (row.agent_name || '').toString().trim() || 'Unknown Agent';
      const durationIn = parseNum(row.duration_in);
      const durationOut = parseNum(row.duration_out);
      const callStartTimeStr = row.call_start_time_in;

      let callTime = null;
      if (callStartTimeStr) {
        const parsed = new Date(callStartTimeStr);
        if (!isNaN(parsed.getTime())) {
          callTime = parsed;
        }
      }

      if (!performanceMap[agent]) {
        performanceMap[agent] = {
          agent_name: agent,
          totalCalls: 0,
          incomingReceived: 0,
          outgoingCalls: 0,
          longCalls: 0, // > 120s duration
          totalDurationIn: 0,
          totalDurationOut: 0,
          firstCallTime: null,
          lastCallTime: null,
          rawCalls: []
        };
      }

      const perf = performanceMap[agent];
      perf.totalCalls += 1;

      if (durationIn > 0) {
        perf.incomingReceived += 1;
      }
      if (durationOut > 0) {
        perf.outgoingCalls += 1;
      }
      if (durationIn > 120 || durationOut > 120) {
        perf.longCalls += 1;
      }
      perf.totalDurationIn += durationIn;
      perf.totalDurationOut += durationOut;

      if (callTime) {
        perf.rawCalls.push({
          time: callTime,
          duration: Math.max(durationIn, durationOut),
          Src: row.Src
        });

        if (!perf.firstCallTime || callTime < perf.firstCallTime) {
          perf.firstCallTime = callTime;
        }
        if (!perf.lastCallTime || callTime > perf.lastCallTime) {
          perf.lastCallTime = callTime;
        }
      }
    });

    // Sort calls and compute gaps > 10 mins (600s)
    Object.values(performanceMap).forEach(perf => {
      perf.rawCalls.sort((a, b) => a.time - b.time);
      perf.gaps = [];
      for (let i = 1; i < perf.rawCalls.length; i++) {
        const prev = perf.rawCalls[i - 1];
        const curr = perf.rawCalls[i];
        
        // End time of previous call
        const prevEnd = new Date(prev.time.getTime() + prev.duration * 1000);
        // Gap to current call start
        const gapSecs = (curr.time.getTime() - prevEnd.getTime()) / 1000;

        if (gapSecs > 600) { // > 10 minutes
          perf.gaps.push({
            from: prevEnd,
            to: curr.time,
            duration: gapSecs,
            prevSrc: prev.Src,
            currSrc: curr.Src
          });
        }
      }
    });

    return Object.values(performanceMap);
  }, [rawData]);

  // Unique filter dropdown values
  const agentsList = useMemo(() => {
    const list = new Set(rawData.map(r => (r.agent_name || '').toString().trim() || 'Unknown Agent'));
    return ['All', ...Array.from(list).filter(Boolean).sort()];
  }, [rawData]);

  const departmentsList = useMemo(() => {
    const list = new Set(rawData.map(r => (r.calllevel_department || '').toString().trim()));
    return ['All', ...Array.from(list).filter(Boolean).sort()];
  }, [rawData]);

  const statusesList = useMemo(() => {
    const list = new Set(rawData.map(r => (r.call_status_out || '').toString().trim()));
    return ['All', ...Array.from(list).filter(Boolean).sort()];
  }, [rawData]);

  // Filtered detailed logs
  const filteredLogs = useMemo(() => {
    return rawData.filter(row => {
      const agent = (row.agent_name || '').toString().trim() || 'Unknown Agent';
      const dept = (row.calllevel_department || '').toString().trim();
      const status = (row.call_status_out || '').toString().trim();

      const matchesAgent = selectedAgent === 'All' || agent === selectedAgent;
      const matchesDept = selectedDepartment === 'All' || dept === selectedDepartment;
      const matchesStatus = selectedStatus === 'All' || status === selectedStatus;

      const matchesSearch = searchQuery === '' || 
        (row.Src && row.Src.toString().toLowerCase().includes(searchQuery.toLowerCase())) ||
        agent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesAgent && matchesDept && matchesStatus && matchesSearch;
    });
  }, [rawData, selectedAgent, selectedDepartment, selectedStatus, searchQuery]);

  // Sorted and Paginated detailed logs
  const sortedAndPaginatedLogs = useMemo(() => {
    let result = [...filteredLogs];

    if (sortField) {
      result.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // Parse numbers if applicable
        if (sortField === 'duration_in' || sortField === 'duration_out') {
          valA = parseNum(valA);
          valB = parseNum(valB);
        } else {
          valA = (valA || '').toString().toLowerCase();
          valB = (valB || '').toString().toLowerCase();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const startIndex = (currentPage - 1) * pageSize;
    return result.slice(startIndex, startIndex + pageSize);
  }, [filteredLogs, sortField, sortOrder, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Export handlers
  const exportPerformanceSummary = () => {
    if (agentPerformance.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(agentPerformance.map(p => ({
      'Agent Name': p.agent_name,
      'Total Calls Taken': p.totalCalls,
      'Incoming Calls Received (duration_in > 0)': p.incomingReceived,
      'Outgoing Calls (duration_out > 0)': p.outgoingCalls,
      'Long Calls (> 120s)': p.longCalls,
      'Total Incoming Duration': formatDuration(p.totalDurationIn),
      'Total Outgoing Duration': formatDuration(p.totalDurationOut),
      'First Call Start Time': p.firstCallTime ? p.firstCallTime.toLocaleString() : '-',
      'Last Call Start Time': p.lastCallTime ? p.lastCallTime.toLocaleString() : '-',
      'Gaps Count (> 10m)': p.gaps.length,
      'Gaps Details': p.gaps.map(g => `${formatDuration(g.duration)} gap (${g.from.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} to ${g.to.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})`).join('; ') || 'No Gaps'
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Performance Summary');
    XLSX.writeFile(wb, `Agent_Performance_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportCleanedLogs = () => {
    if (filteredLogs.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(filteredLogs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cleaned Logs');
    XLSX.writeFile(wb, `Cleaned_Call_Logs_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Award style={{ color: 'var(--primary)' }} size={32} />
            Audit Agent Performance
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Upload raw call logs, clean extra columns, and audit agent level statistics.
          </p>
        </div>

        {rawData.length > 0 && (
          <button onClick={clearData} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--error)', color: 'var(--error)' }}>
            <Trash2 size={16} />
            Reset Audit
          </button>
        )}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
          <ShieldAlert style={{ color: 'var(--error)' }} size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload State */}
      {rawData.length === 0 ? (
        <div 
          className="glass-panel"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          style={{
            padding: '5rem 2rem',
            textAlign: 'center',
            border: dragActive ? '2px dashed var(--primary)' : '1px dashed var(--border-color)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backgroundColor: dragActive ? 'rgba(74, 222, 128, 0.05)' : 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            borderRadius: '16px'
          }}
        >
          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '50%', border: '1px solid var(--border-color)' }}>
            <Upload size={48} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Drag and Drop your Excel/CSV here</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Only columns matching standard format will be imported. We support <strong>.xlsx, .xls, and .csv</strong>
            </p>
          </div>
          <div>
            <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', gap: '0.5rem' }}>
              <FileSpreadsheet size={18} />
              Browse File
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileInput} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>
          {loading && <p style={{ color: 'var(--primary)' }}>Processing file content, please wait...</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Top Performance Analytics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>File Loaded</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={fileName}>
                {fileName}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cleaned {rawData.length} entries</span>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Audited Agents</span>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {agentPerformance.length}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Unique agents in call log</span>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Long Calls (&gt; 120s)</span>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>
                {rawData.filter(r => parseNum(r.duration_in) > 120 || parseNum(r.duration_out) > 120).length}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Calls exceeding 2 minutes</span>
            </div>
          </div>

          {/* DATABASE SYNC SECTION */}
          <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Database style={{ color: 'var(--primary)' }} size={20} />
                  Database Sync Control
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                  Save date-wise call log summaries directly to the database daily entries table.
                </p>
              </div>
              <button 
                onClick={handleSyncToDatabase} 
                disabled={syncing}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {syncing ? <RefreshCw size={16} className="spin" /> : <Database size={16} />}
                {syncing ? 'Syncing to DB...' : 'Sync Calls to Database'}
              </button>
            </div>

            {/* Sync Feedback Message */}
            {syncStatus && (
              <div style={{ 
                padding: '1rem', 
                borderRadius: '8px', 
                border: `1px solid ${syncStatus.type === 'success' ? 'var(--primary)' : syncStatus.type === 'warning' ? '#f59e0b' : 'var(--error)'}`,
                backgroundColor: syncStatus.type === 'success' ? 'rgba(74, 222, 128, 0.05)' : syncStatus.type === 'warning' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                color: 'var(--text-main)',
                fontSize: '0.9rem'
              }}>
                {syncStatus.message}
              </div>
            )}

            {/* Unmatched Agents Warnings */}
            {unmatchedAgentsList.length > 0 && (
              <div style={{ 
                padding: '1rem', 
                borderRadius: '8px', 
                border: '1px solid rgba(245, 158, 11, 0.3)',
                backgroundColor: 'rgba(245, 158, 11, 0.02)',
                fontSize: '0.85rem'
              }}>
                <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '0.5rem' }}>
                  ⚠️ Unmatched Agent Names ({unmatchedAgentsList.length})
                </strong>
                <span style={{ color: 'var(--text-muted)' }}>
                  The following agents in the Excel could not be found in the database. Their call counts were not saved:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {unmatchedAgentsList.map((name, idx) => (
                    <span key={idx} style={{ 
                      backgroundColor: 'rgba(255,255,255,0.05)', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)'
                    }}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 1: AGENT-WISE SUMMARY */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Agent Performance Summary</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Consolidated metrics per agent parsed from the spreadsheet.</p>
              </div>
              <button onClick={exportPerformanceSummary} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} />
                Export Summary Excel
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Agent Name</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>Total Calls</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>Incoming Calls (Received)</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>Outgoing Calls</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>Long Calls (&gt; 120s)</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>Incoming Duration</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>Outgoing Duration</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>First Call Start</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>Last Call Start</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>Gaps (&gt; 10m)</th>
                  </tr>
                </thead>
                <tbody>
                  {agentPerformance.map((perf, index) => (
                    <React.Fragment key={index}>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', backgroundColor: expandedAgents[perf.agent_name] ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 500 }}>{perf.agent_name}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'center' }}>{perf.totalCalls}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'center', color: 'var(--primary)' }}>{perf.incomingReceived}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'center' }}>{perf.outgoingCalls}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'center', color: '#f59e0b', fontWeight: perf.longCalls > 0 ? '600' : 'normal' }}>
                          {perf.longCalls}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'center' }}>{formatDuration(perf.totalDurationIn)}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'center' }}>{formatDuration(perf.totalDurationOut)}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'center', color: 'var(--secondary)', fontWeight: '500' }}>
                          {perf.firstCallTime ? perf.firstCallTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'center', color: 'var(--secondary)', fontWeight: '500' }}>
                          {perf.lastCallTime ? perf.lastCallTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'center' }}>
                          {perf.gaps.length > 0 ? (
                            <button 
                              onClick={() => setExpandedAgents(prev => ({ ...prev, [perf.agent_name]: !prev[perf.agent_name] }))}
                              className="btn btn-secondary" 
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                color: '#ef4444', 
                                borderColor: 'rgba(239, 68, 68, 0.3)', 
                                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                fontSize: '0.75rem', 
                                display: 'inline-flex', 
                                gap: '0.25rem', 
                                alignItems: 'center' 
                              }}
                            >
                              {perf.gaps.length} Gaps
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None</span>
                          )}
                        </td>
                      </tr>
                      {expandedAgents[perf.agent_name] && perf.gaps.length > 0 && (
                        <tr style={{ backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
                          <td colSpan={10} style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ borderLeft: '3px solid #ef4444', paddingLeft: '1rem' }}>
                              <h4 style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600, marginBottom: '0.5rem' }}>
                                Gap Analysis Details ({perf.agent_name})
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {perf.gaps.map((gap, gIdx) => (
                                  <div key={gIdx} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    • Gap of <strong style={{ color: 'var(--text-main)' }}>{formatDuration(gap.duration)}</strong> between call to <strong style={{ color: 'var(--text-main)' }}>{gap.prevSrc || 'Unknown'}</strong> (ended at {gap.from.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) and call to <strong style={{ color: 'var(--text-main)' }}>{gap.currSrc || 'Unknown'}</strong> (started at {gap.to.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2: CLEANED DETAILED LOGS */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Cleaned Call Logs</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Displaying only the required columns. Columns not needed have been filtered out.</p>
              </div>
              <button onClick={exportCleanedLogs} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} />
                Export Cleaned Excel
              </button>
            </div>

            {/* Filters Row */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Search Src or Agent..." 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ width: '100%', paddingLeft: '2.5rem', marginBottom: 0 }}
                />
              </div>

              {/* Agent Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Agent:</span>
                <select 
                  className="input-field" 
                  value={selectedAgent} 
                  onChange={(e) => { setSelectedAgent(e.target.value); setCurrentPage(1); }}
                  style={{ marginBottom: 0, padding: '0.4rem 2rem 0.4rem 0.75rem' }}
                >
                  {agentsList.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* Department Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dept:</span>
                <select 
                  className="input-field" 
                  value={selectedDepartment} 
                  onChange={(e) => { setSelectedDepartment(e.target.value); setCurrentPage(1); }}
                  style={{ marginBottom: 0, padding: '0.4rem 2rem 0.4rem 0.75rem' }}
                >
                  {departmentsList.map(d => (
                    <option key={d} value={d === '' ? 'Empty' : d}>{d === '' ? 'Empty' : d}</option>
                  ))}
                </select>
              </div>

              {/* Call Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</span>
                <select 
                  className="input-field" 
                  value={selectedStatus} 
                  onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                  style={{ marginBottom: 0, padding: '0.4rem 2rem 0.4rem 0.75rem' }}
                >
                  {statusesList.map(s => (
                    <option key={s} value={s === '' ? 'Empty' : s}>{s === '' ? 'Empty' : s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Detailed Table */}
            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {REQUIRED_COLUMNS.map(col => (
                      <th 
                        key={col} 
                        onClick={() => handleSort(col)}
                        style={{ 
                          padding: '0.75rem 1rem', 
                          color: 'var(--text-muted)', 
                          fontWeight: 600, 
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {col}
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAndPaginatedLogs.map((row, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{row.Src}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
                        {row.call_start_time_in ? new Date(row.call_start_time_in).toLocaleString() : ''}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{row.duration_in}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{row.duration_out}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{row.call_status_out}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{row.outgoing_picked}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{row.calllevel_department}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 500 }}>{row.agent_name}</td>
                    </tr>
                  ))}
                  {sortedAndPaginatedLogs.length === 0 && (
                    <tr>
                      <td colSpan={REQUIRED_COLUMNS.length} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No records found matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredLogs.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Showing {Math.min(filteredLogs.length, (currentPage - 1) * pageSize + 1)} to {Math.min(filteredLogs.length, currentPage * pageSize)} of {filteredLogs.length} logs
                </span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                    disabled={currentPage === 1}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '0.85rem' }}>Page {currentPage} of {totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
};

export default AuditAgent;
