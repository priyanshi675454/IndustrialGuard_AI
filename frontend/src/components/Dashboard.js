import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';
import { jsPDF } from 'jspdf';

const API = 'http://localhost:3001';

const defaultMachines = [
  { machine_id: 'M001', name: 'Turbine A', temperature: 92, vibration: 55, pressure: 125, rpm: 3600, oil_level: 60, hours_run: 3000, sampleRisk: 84, sampleStatus: 'CRITICAL' },
  { machine_id: 'M002', name: 'Compressor B', temperature: 70, vibration: 30, pressure: 95, rpm: 2800, oil_level: 75, hours_run: 1200, sampleRisk: 47, sampleStatus: 'WARNING' },
  { machine_id: 'M003', name: 'Pump C', temperature: 88, vibration: 48, pressure: 118, rpm: 3400, oil_level: 55, hours_run: 4100, sampleRisk: 29, sampleStatus: 'NORMAL' },
  { machine_id: 'M004', name: 'Motor D', temperature: 65, vibration: 22, pressure: 88, rpm: 2500, oil_level: 85, hours_run: 800, sampleRisk: 16, sampleStatus: 'NORMAL' },
  { machine_id: 'M005', name: 'Generator E', temperature: 95, vibration: 60, pressure: 130, rpm: 3800, oil_level: 45, hours_run: 4800, sampleRisk: 67, sampleStatus: 'WARNING' },
];

const QUICK_REPLIES = [
  '🔴 Which machine is most critical?',
  '🛠️ What maintenance should I do first?',
  '📊 Explain the risk percentages',
  '🌡️ What causes high temperature risk?',
  '🔗 How does blockchain help here?',
  '💡 How to reduce failure risk?',
  '📳 What does high vibration mean?',
  '💧 What if oil level is low?',
];

const StatusBadge = ({ status, sample }) => {
  const colors = {
    CRITICAL: { bg: '#ff1744', text: 'white' },
    WARNING: { bg: '#ff9100', text: 'white' },
    NORMAL: { bg: '#00e676', text: 'black' },
    ERROR: { bg: '#444', text: 'white' },
  };
  const color = colors[status] || colors.NORMAL;
  return (
    <span style={{
      background: color.bg, color: color.text,
      padding: '3px 10px', borderRadius: '20px',
      fontSize: '11px', fontWeight: 'bold',
      opacity: sample ? 0.6 : 1,
      border: sample ? '1px dashed rgba(255,255,255,0.3)' : 'none'
    }}>
      {status}{sample ? ' ~' : ''}
    </span>
  );
};

const RiskBar = ({ percent, sample }) => {
  const color = percent >= 70 ? '#ff1744' : percent >= 40 ? '#ff9100' : '#00e676';
  return (
    <div style={{ background: '#1a1f35', borderRadius: '10px', height: '8px', width: '100%' }}>
      <div style={{
        width: `${Math.min(percent, 100)}%`, height: '100%',
        background: sample ? `${color}88` : color,
        borderRadius: '10px', transition: 'width 1s ease'
      }} />
    </div>
  );
};

const inp = {
  background: '#0a0e1a', border: '1px solid #1a1f35',
  borderRadius: '8px', padding: '9px 13px', color: 'white',
  fontSize: '13px', width: '100%', outline: 'none', boxSizing: 'border-box'
};

const lbl = { color: '#888', fontSize: '11px', marginBottom: '5px', display: 'block' };

export default function Dashboard() {
  const [allMachines, setAllMachines] = useState(defaultMachines);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [activeTab, setActiveTab] = useState('preset');
  const [customResult, setCustomResult] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [scanCount, setScanCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: '👋 Hi! I am IndustrialGuard AI Assistant. Ask me anything or pick a quick question below! Run a scan first for live machine data.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const chatEndRef = useRef(null);

  const [form, setForm] = useState({
    machine_id: '', name: '', temperature: '',
    vibration: '', pressure: '', rpm: '', oil_level: '', hours_run: '',
  });

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  useEffect(() => {
    axios.get(`${API}/api/health`).then(r => setServerStatus(r.data)).catch(() =>
      setServerStatus({ blockchain: '❌ Disconnected', ai: '❌ Down' })
    );
  }, []);

  useEffect(() => {
    fetchLogs();
    const iv = setInterval(fetchLogs, 30000);
    return () => clearInterval(iv);
  }, []);

  const filteredMachines = allMachines.filter(m =>
    m.machine_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLogs = logs.filter(l =>
    l.machineId?.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.status?.toLowerCase().includes(logSearch.toLowerCase())
  );

  const handleFormChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const addMachineToList = () => {
    if (!form.machine_id || !form.name || !form.temperature) {
      alert('Machine ID, Name, and Temperature are required!'); return;
    }
    if (allMachines.find(m => m.machine_id === form.machine_id)) {
      alert(`Machine ID ${form.machine_id} already exists!`); return;
    }
    const nm = {
      machine_id: form.machine_id, name: form.name,
      temperature: parseFloat(form.temperature),
      vibration: parseFloat(form.vibration) || 30,
      pressure: parseFloat(form.pressure) || 100,
      rpm: parseFloat(form.rpm) || 3000,
      oil_level: parseFloat(form.oil_level) || 70,
      hours_run: parseFloat(form.hours_run) || 1000,
      sampleRisk: null, sampleStatus: null
    };
    setAllMachines(prev => [...prev, nm]);
    setForm({ machine_id: '', name: '', temperature: '', vibration: '', pressure: '', rpm: '', oil_level: '', hours_run: '' });
    setShowAddForm(false);
    alert(`✅ ${nm.name} added! Click "Scan All" to analyze it.`);
  };

  const analyzeCustom = async () => {
    if (!form.machine_id || !form.name || !form.temperature) {
      alert('Machine ID, Name, and Temperature are required!'); return;
    }
    setCustomLoading(true);
    setCustomResult(null);
    try {
      const payload = {
        machine_id: form.machine_id,
        temperature: parseFloat(form.temperature),
        vibration: parseFloat(form.vibration) || 30,
        pressure: parseFloat(form.pressure) || 100,
        rpm: parseFloat(form.rpm) || 3000,
        oil_level: parseFloat(form.oil_level) || 70,
        hours_run: parseFloat(form.hours_run) || 1000,
      };
      const res = await axios.post(`${API}/api/analyze`, payload);
      setCustomResult({ ...payload, name: form.name, ...res.data });
      fetchLogs();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
    setCustomLoading(false);
  };

  const analyzeAll = async () => {
    setLoading(true);
    const newResults = [];
    for (const machine of allMachines) {
      try {
        const res = await axios.post(`${API}/api/analyze`, machine);
        newResults.push({ ...machine, ...res.data });
      } catch (e) {
        newResults.push({ ...machine, status: 'ERROR', risk_percent: 0, action: 'Check that AI server is running (cd ai → python predict.py)' });
      }
    }
    setResults(newResults);
    setChartData(newResults.filter(r => r.status !== 'ERROR').map(r => ({ name: r.name, risk: r.risk_percent })));
    setScanCount(prev => prev + 1);
    const entry = { scan: `Scan ${scanCount + 1}` };
    newResults.filter(r => r.status !== 'ERROR').forEach(r => { entry[r.name] = r.risk_percent; });
    setHistoryData(prev => [...prev, entry]);
    setLoading(false);
    fetchLogs();
  };

  const fetchLogs = async () => {
    setRefreshLoading(true);
    try {
      const res = await axios.get(`${API}/api/logs`);
      if (res.data?.logs) setLogs(res.data.logs.reverse());
    } catch (e) { } finally { setRefreshLoading(false); }
  };

  const generateWorkOrder = (machine) => {
    const doc = new jsPDF();
    const now = new Date().toLocaleString();
    doc.setFillColor(10, 14, 26); doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(0, 229, 255); doc.setFontSize(20); doc.text('INDUSTRIALGUARD AI', 20, 25);
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.text('MAINTENANCE WORK ORDER', 20, 36);
    doc.setDrawColor(0, 229, 255); doc.line(20, 40, 190, 40);
    doc.setFontSize(10); doc.setTextColor(150, 150, 150);
    doc.text('Generated: ' + now, 20, 50); doc.text('WO#: WO-' + Date.now(), 20, 57);
    doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.text('MACHINE DETAILS', 20, 70);
    doc.setFontSize(10); doc.setTextColor(200, 200, 200);
    doc.text('ID: ' + machine.machine_id, 20, 82); doc.text('Name: ' + machine.name, 20, 90);
    doc.text('Status: ' + machine.status, 20, 98); doc.text('Risk: ' + machine.risk_percent + '%', 20, 106);
    doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.text('SENSOR READINGS', 20, 120);
    doc.setFontSize(10); doc.setTextColor(200, 200, 200);
    doc.text('Temperature: ' + machine.temperature + 'C', 20, 132);
    doc.text('Vibration: ' + machine.vibration + ' Hz', 20, 140);
    doc.text('Pressure: ' + machine.pressure + ' bar', 20, 148);
    doc.text('RPM: ' + machine.rpm, 20, 156);
    doc.text('Oil Level: ' + machine.oil_level + '%', 20, 164);
    doc.text('Hours Run: ' + machine.hours_run, 20, 172);
    doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.text('ACTION REQUIRED', 20, 186);
    doc.setFontSize(10); doc.setTextColor(255, 23, 68); doc.text(machine.action || 'Immediate maintenance required!', 20, 198);
    doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.text('BLOCKCHAIN VERIFICATION', 20, 215);
    doc.setFontSize(10); doc.setTextColor(0, 230, 118);
    doc.text('Record permanently logged on blockchain', 20, 227);
    doc.text('Tamper-proof audit trail verified', 20, 235);
    doc.setDrawColor(0, 229, 255); doc.line(20, 265, 190, 265);
    doc.setTextColor(80, 80, 80); doc.setFontSize(8);
    doc.text('IndustrialGuard AI - Powered by ML + Blockchain', 20, 274);
    doc.save(`WO_${machine.machine_id}_${Date.now()}.pdf`);
  };

  const sendChat = async (override) => {
    const msg = override || chatInput;
    if (!msg.trim() || chatLoading) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);
    try {
      const res = await axios.post(`${API}/api/chat`, { message: msg, machineData: results.length > 0 ? results : allMachines });
      setChatMessages(prev => [...prev, { role: 'ai', text: res.data.reply }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'ai', text: '⚠️ Could not connect. Make sure backend is running on port 3001!' }]);
    }
    setChatLoading(false);
  };

  const critical = results.filter(r => r.status === 'CRITICAL').length;
  const warning = results.filter(r => r.status === 'WARNING').length;
  const normal = results.filter(r => r.status === 'NORMAL').length;
  const scanned = results.length > 0;

  return (
    <div style={{ padding: '18px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#00e5ff', margin: 0 }}>⚙️ IndustrialGuard AI</h1>
          <p style={{ color: '#888', marginTop: '4px', fontSize: '13px' }}>
            AI Predictive Maintenance + Blockchain Audit &nbsp;
            <span style={{ color: '#00e676', fontSize: '11px' }}>🟢 LIVE</span>
          </p>
        </div>
        {serverStatus && (
          <div style={{ background: '#111827', borderRadius: '10px', padding: '10px 16px', fontSize: '12px', lineHeight: '1.8' }}>
            <div>🔗 Blockchain: <span style={{ color: serverStatus.blockchain?.includes('✅') ? '#00e676' : '#ff1744', fontWeight: 'bold' }}>{serverStatus.blockchain}</span></div>
            <div>🤖 AI Server: <span style={{ color: serverStatus.ai?.includes('✅') ? '#00e676' : '#ff1744', fontWeight: 'bold' }}>{serverStatus.ai}</span></div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        {[{ k: 'preset', l: '🏭 All Machines' }, { k: 'custom', l: '🔬 Analyze Machine' }].map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
            padding: '9px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px',
            background: activeTab === t.k ? 'linear-gradient(135deg, #00e5ff, #0091ea)' : '#111827',
            color: activeTab === t.k ? 'white' : '#888',
          }}>{t.l}</button>
        ))}
      </div>

      {/* ═══ ALL MACHINES TAB ═══ */}
      {activeTab === 'preset' && (<>

        {/* Search + Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '14px' }}>🔍</span>
            <input placeholder="Search by ID or Name (e.g. M001, Turbine)" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ ...inp, paddingLeft: '34px' }} />
          </div>
          <button onClick={() => setShowAddForm(!showAddForm)} style={{
            background: showAddForm ? '#2a1535' : '#111827', color: showAddForm ? '#ff9100' : '#00e5ff',
            border: `1px solid ${showAddForm ? '#ff9100' : '#00e5ff'}`,
            padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px'
          }}>{showAddForm ? '✕ Cancel' : '➕ Add Machine'}</button>
          <button onClick={analyzeAll} disabled={loading} style={{
            background: loading ? '#333' : 'linear-gradient(135deg, #00e5ff, #0091ea)',
            color: loading ? '#888' : 'white', border: 'none',
            padding: '9px 20px', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '13px', fontWeight: 'bold'
          }}>{loading ? '🔄 Scanning...' : `🚀 Scan All (${allMachines.length})`}</button>
        </div>

        {/* Machine ID Quick Filter Pills */}
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {allMachines.map((m, i) => (
            <span key={i} onClick={() => setSearchQuery(searchQuery === m.machine_id ? '' : m.machine_id)} style={{
              background: searchQuery === m.machine_id ? '#00e5ff22' : '#111827',
              border: `1px solid ${searchQuery === m.machine_id ? '#00e5ff' : '#1a1f35'}`,
              color: searchQuery === m.machine_id ? '#00e5ff' : '#666',
              padding: '3px 11px', borderRadius: '20px', fontSize: '11px',
              cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
            }}>{m.machine_id}</span>
          ))}
          {searchQuery && (
            <span onClick={() => setSearchQuery('')} style={{
              background: '#ff174418', border: '1px solid #ff1744', color: '#ff1744',
              padding: '3px 11px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer'
            }}>✕ Clear</span>
          )}
        </div>

        {/* Add Machine Inline Form */}
        {showAddForm && (
          <div style={{ background: '#111827', borderRadius: '12px', padding: '18px', marginBottom: '16px', border: '1px solid #00e5ff33' }}>
            <h3 style={{ color: '#00e5ff', marginBottom: '14px', fontSize: '14px' }}>➕ Register New Machine</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              {[
                { label: 'Machine ID *', name: 'machine_id', placeholder: 'e.g. MD109' },
                { label: 'Machine Name *', name: 'name', placeholder: 'e.g. Boiler X' },
                { label: 'Temperature °C *', name: 'temperature', placeholder: '85' },
                { label: 'Vibration Hz', name: 'vibration', placeholder: '40' },
                { label: 'Pressure bar', name: 'pressure', placeholder: '110' },
                { label: 'RPM', name: 'rpm', placeholder: '3200' },
                { label: 'Oil Level %', name: 'oil_level', placeholder: '65' },
                { label: 'Hours Run', name: 'hours_run', placeholder: '2500' },
              ].map(f => (
                <div key={f.name}>
                  <label style={lbl}>{f.label}</label>
                  <input type={['machine_id', 'name'].includes(f.name) ? 'text' : 'number'}
                    name={f.name} placeholder={f.placeholder} value={form[f.name]}
                    onChange={handleFormChange} style={inp} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
              <button onClick={addMachineToList} style={{
                background: 'linear-gradient(135deg, #00e5ff, #0091ea)', color: 'white',
                border: 'none', padding: '9px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px'
              }}>✅ Add to List</button>
              <p style={{ color: '#555', fontSize: '12px', margin: 0 }}>Then click "Scan All" to analyze</p>
            </div>
          </div>
        )}

        {/* Sample Data Notice */}
        {!scanned && (
          <div style={{ padding: '10px 14px', background: '#0a1628', borderRadius: '8px', marginBottom: '14px', border: '1px solid #1a3a5c', fontSize: '12px', color: '#6a9fd8' }}>
            👁️ Showing <strong>sample preview data</strong> — click <strong>"Scan All"</strong> to get real AI predictions from your sensors
          </div>
        )}

        {/* Stats Cards — shown after scan */}
        {scanned && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {[
              { l: 'Total', v: results.length, c: '#00e5ff', i: '🏭' },
              { l: 'Critical', v: critical, c: '#ff1744', i: '🚨' },
              { l: 'Warning', v: warning, c: '#ff9100', i: '⚠️' },
              { l: 'Normal', v: normal, c: '#00e676', i: '✅' },
            ].map((card, i) => (
              <div key={i} style={{ background: '#111827', borderRadius: '10px', padding: '14px', borderLeft: `3px solid ${card.c}` }}>
                <div style={{ fontSize: '20px' }}>{card.i}</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: card.c }}>{card.v}</div>
                <div style={{ color: '#888', fontSize: '12px' }}>{card.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Machine Cards */}
        {filteredMachines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            <div style={{ fontSize: '40px' }}>🔍</div>
            <p>No machines match "{searchQuery}"</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {filteredMachines.map((machine, i) => {
              const result = results.find(r => r.machine_id === machine.machine_id);
              const isSample = !result;
              const riskPct = result ? result.risk_percent : machine.sampleRisk;
              const status = result ? result.status : machine.sampleStatus;
              const action = result ? result.action : (status === 'CRITICAL' ? 'Immediate maintenance required!' : status === 'WARNING' ? 'Schedule maintenance soon.' : 'Machine operating normally.');

              return (
                <div key={i} style={{
                  background: '#111827', borderRadius: '12px', padding: '16px',
                  border: `1px solid ${status === 'CRITICAL' ? (isSample ? '#ff174455' : '#ff1744') : status === 'WARNING' ? (isSample ? '#ff910055' : '#ff9100') : '#1a1f35'}`,
                  position: 'relative', transition: 'border 0.3s'
                }}>
                  {isSample && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#1a1f35', borderRadius: '4px', padding: '2px 7px', fontSize: '10px', color: '#555' }}>
                      PREVIEW
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', paddingRight: isSample ? '60px' : '0' }}>
                    <div>
                      <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '14px' }}>{machine.name}</h3>
                      <span style={{ color: '#00e5ff', fontSize: '11px', fontWeight: 'bold' }}>{machine.machine_id}</span>
                    </div>
                    {status && <StatusBadge status={status} sample={isSample} />}
                  </div>

                  {riskPct !== null && riskPct !== undefined && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ color: '#888', fontSize: '12px' }}>Failure Risk</span>
                        <span style={{ fontWeight: 'bold', fontSize: '13px', opacity: isSample ? 0.6 : 1, color: riskPct >= 70 ? '#ff1744' : riskPct >= 40 ? '#ff9100' : '#00e676' }}>
                          {riskPct}%{isSample ? ' ~' : ''}
                        </span>
                      </div>
                      <RiskBar percent={riskPct} sample={isSample} />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '12px', color: '#888', marginBottom: '10px' }}>
                    <span>🌡️ {machine.temperature}°C</span>
                    <span>📳 {machine.vibration} Hz</span>
                    <span>💧 {machine.oil_level}%</span>
                    <span>⚡ {machine.rpm} RPM</span>
                  </div>

                  <div style={{ padding: '6px 8px', background: '#0a0e1a', borderRadius: '6px', fontSize: '11px', color: '#888', marginBottom: '6px' }}>
                    {isSample ? '🔍 Click "Scan All" for real AI prediction' : result?.blockchain_logged ? '🔗 Blockchain Logged ✅' : '⚠️ Blockchain unavailable'}
                  </div>

                  <div style={{ fontSize: '11px', color: '#777', marginBottom: isSample ? 0 : '8px' }}>
                    📋 {action}
                  </div>

                  {!isSample && result.status !== 'NORMAL' && result.status !== 'ERROR' && (
                    <button onClick={() => generateWorkOrder(result)} style={{
                      width: '100%', background: 'linear-gradient(135deg, #ff1744, #c62828)',
                      color: 'white', border: 'none', padding: '7px',
                      borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', marginTop: '4px'
                    }}>📄 Download Work Order PDF</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bar Chart */}
        {chartData.length > 0 && (
          <div style={{ background: '#111827', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
            <h2 style={{ marginBottom: '12px', color: '#00e5ff', fontSize: '15px' }}>📊 Risk Analysis Chart</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1f35" />
                <XAxis dataKey="name" stroke="#888" tick={{ fontSize: 11 }} />
                <YAxis stroke="#888" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1a1f35', fontSize: '12px' }} />
                <Bar dataKey="risk" fill="#00e5ff" radius={[4, 4, 0, 0]} name="Risk %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History Line Chart */}
        {historyData.length > 1 && (
          <div style={{ background: '#111827', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
            <h2 style={{ marginBottom: '12px', color: '#00e5ff', fontSize: '15px' }}>📈 Risk History Trend</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1f35" />
                <XAxis dataKey="scan" stroke="#888" tick={{ fontSize: 11 }} />
                <YAxis stroke="#888" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1a1f35', fontSize: '12px' }} />
                {allMachines.map((m, i) => {
                  const cols = ['#ff1744', '#ff9100', '#00e5ff', '#00e676', '#d500f9', '#ffea00', '#ff6d00'];
                  return <Line key={m.name} type="monotone" dataKey={m.name} stroke={cols[i % cols.length]} strokeWidth={2} dot={true} />;
                })}
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
              {allMachines.map((m, i) => {
                const cols = ['#ff1744', '#ff9100', '#00e5ff', '#00e676', '#d500f9', '#ffea00', '#ff6d00'];
                return <span key={i} style={{ fontSize: '11px', color: cols[i % cols.length] }}>● {m.name}</span>;
              })}
            </div>
          </div>
        )}
      </>)}

      {/* ═══ ANALYZE MACHINE TAB ═══ */}
      {activeTab === 'custom' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(280px,1fr)', gap: '18px', marginBottom: '18px' }}>
          <div style={{ background: '#111827', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ color: '#00e5ff', marginBottom: '16px', fontSize: '15px' }}>🔬 Enter Machine Details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'Machine ID *', name: 'machine_id', placeholder: 'e.g. MD45' },
                { label: 'Machine Name *', name: 'name', placeholder: 'e.g. Boiler Unit' },
                { label: 'Temperature °C *', name: 'temperature', placeholder: '85' },
                { label: 'Vibration Hz', name: 'vibration', placeholder: '40' },
                { label: 'Pressure bar', name: 'pressure', placeholder: '110' },
                { label: 'RPM', name: 'rpm', placeholder: '3200' },
                { label: 'Oil Level %', name: 'oil_level', placeholder: '65' },
                { label: 'Hours Run', name: 'hours_run', placeholder: '2500' },
              ].map(f => (
                <div key={f.name}>
                  <label style={lbl}>{f.label}</label>
                  <input type={['machine_id', 'name'].includes(f.name) ? 'text' : 'number'}
                    name={f.name} placeholder={f.placeholder}
                    value={form[f.name]} onChange={handleFormChange} style={inp} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: '12px', padding: '9px', background: '#0a0e1a', borderRadius: '7px', fontSize: '11px', color: '#666' }}>
              💡 Only Machine ID, Name, and Temperature are required. Others use safe defaults.
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={analyzeCustom} disabled={customLoading} style={{
                flex: 1, background: customLoading ? '#333' : 'linear-gradient(135deg, #00e5ff, #0091ea)',
                color: customLoading ? '#888' : 'white', border: 'none', padding: '11px',
                borderRadius: '8px', cursor: customLoading ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 'bold'
              }}>{customLoading ? '🔄 Analyzing...' : '🚀 Analyze Now'}</button>
              <button onClick={addMachineToList} style={{
                background: '#111827', color: '#00e5ff',
                border: '1px solid #00e5ff', padding: '11px 14px', borderRadius: '8px',
                cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
              }}>➕ Save</button>
            </div>
          </div>

          <div>
            {customResult ? (
              <div style={{
                background: '#111827', borderRadius: '12px', padding: '20px',
                border: `2px solid ${customResult.status === 'CRITICAL' ? '#ff1744' : customResult.status === 'WARNING' ? '#ff9100' : '#00e676'}`
              }}>
                <h2 style={{ color: '#00e5ff', marginBottom: '14px', fontSize: '15px' }}>📋 AI Analysis Result</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{customResult.name}</h3>
                    <span style={{ color: '#00e5ff', fontSize: '12px' }}>{customResult.machine_id}</span>
                  </div>
                  <StatusBadge status={customResult.status} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#888', fontSize: '12px' }}>Failure Risk</span>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: customResult.risk_percent >= 70 ? '#ff1744' : customResult.risk_percent >= 40 ? '#ff9100' : '#00e676' }}>
                      {customResult.risk_percent}%
                    </span>
                  </div>
                  <RiskBar percent={customResult.risk_percent} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  {[
                    { i: '🌡️', l: 'Temp', v: `${customResult.temperature}°C` },
                    { i: '📳', l: 'Vibration', v: `${customResult.vibration} Hz` },
                    { i: '🔵', l: 'Pressure', v: `${customResult.pressure} bar` },
                    { i: '⚡', l: 'RPM', v: customResult.rpm },
                    { i: '💧', l: 'Oil Level', v: `${customResult.oil_level}%` },
                    { i: '⏱️', l: 'Hours', v: `${customResult.hours_run} hrs` },
                  ].map((x, i) => (
                    <div key={i} style={{ background: '#0a0e1a', borderRadius: '7px', padding: '9px' }}>
                      <div style={{ color: '#888', fontSize: '10px' }}>{x.i} {x.l}</div>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '2px' }}>{x.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '10px', background: '#0a0e1a', borderRadius: '7px', marginBottom: '8px' }}>
                  <div style={{ color: '#888', fontSize: '10px', marginBottom: '3px' }}>📋 Recommended Action</div>
                  <div style={{ fontWeight: 'bold', fontSize: '12px', color: customResult.status === 'CRITICAL' ? '#ff1744' : customResult.status === 'WARNING' ? '#ff9100' : '#00e676' }}>
                    {customResult.action}
                  </div>
                </div>
                <div style={{ padding: '9px', background: '#0a0e1a', borderRadius: '7px', fontSize: '11px', marginBottom: '10px' }}>
                  🔗 <span style={{ color: customResult.blockchain_logged ? '#00e676' : '#ff9100' }}>
                    {customResult.blockchain_logged ? 'Logged on Blockchain ✅' : 'Blockchain unavailable ⚠️'}
                  </span>
                </div>
                {customResult.status !== 'NORMAL' && (
                  <button onClick={() => generateWorkOrder(customResult)} style={{
                    width: '100%', background: 'linear-gradient(135deg, #ff1744, #c62828)',
                    color: 'white', border: 'none', padding: '9px',
                    borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                  }}>📄 Download Work Order PDF</button>
                )}
              </div>
            ) : (
              <div style={{
                background: '#111827', borderRadius: '12px', padding: '20px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                alignItems: 'center', color: '#888', minHeight: '360px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔬</div>
                <p style={{ fontSize: '15px', textAlign: 'center', margin: 0 }}>Enter machine sensor data</p>
                <p style={{ fontSize: '14px', color: '#00e5ff', marginTop: '6px' }}>and click "Analyze Now"</p>
                <div style={{ marginTop: '20px', background: '#0a0e1a', borderRadius: '10px', padding: '14px', width: '100%' }}>
                  <p style={{ color: '#555', fontSize: '11px', margin: 0, lineHeight: '1.8' }}>
                    Example inputs to try:<br />
                    🔴 Temp: 95 | Vibration: 60 → CRITICAL<br />
                    🟡 Temp: 75 | Vibration: 45 → WARNING<br />
                    🟢 Temp: 60 | Vibration: 20 → NORMAL
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blockchain Logs */}
      <div style={{ background: '#111827', borderRadius: '12px', padding: '18px', marginBottom: '80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ color: '#00e5ff', fontSize: '15px', margin: 0 }}>🔗 Blockchain Audit Log ({logs.length} records)</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input placeholder="🔍 Search logs..." value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              style={{ ...inp, width: '160px', fontSize: '12px', padding: '7px 11px' }} />
            <button onClick={fetchLogs} disabled={refreshLoading} style={{
              background: '#1a1f35', border: 'none', color: '#888',
              padding: '7px 13px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
            }}>{refreshLoading ? '🔄' : '🔄 Refresh'}</button>
          </div>
        </div>
        {filteredLogs.length === 0 ? (
          <p style={{ color: '#555', textAlign: 'center', padding: '24px', fontSize: '13px' }}>
            {logs.length === 0 ? '📭 No records yet — run a scan to start logging!' : 'No logs match your search.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1f35', color: '#666' }}>
                  {['Machine ID', 'Risk %', 'Status', 'Action', 'Timestamp', 'Recorded By'].map(h => (
                    <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1f3522' }}>
                    <td style={{ padding: '9px 10px', fontWeight: 'bold', color: '#00e5ff' }}>{log.machineId}</td>
                    <td style={{ padding: '9px 10px', fontWeight: 'bold', color: log.riskPercent >= 70 ? '#ff1744' : log.riskPercent >= 40 ? '#ff9100' : '#00e676' }}>
                      {log.riskPercent}%
                    </td>
                    <td style={{ padding: '9px 10px' }}><StatusBadge status={log.status} /></td>
                    <td style={{ padding: '9px 10px', color: '#888' }}>{log.action}</td>
                    <td style={{ padding: '9px 10px', color: '#666', fontSize: '11px' }}>{log.timestamp}</td>
                    <td style={{ padding: '9px 10px', color: '#666', fontSize: '10px' }}>{log.recordedBy?.slice(0, 10)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ AI CHATBOT ═══ */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
        {chatOpen && (
          <div style={{
            position: 'absolute', bottom: '66px', right: '0',
            width: '340px', background: '#0d1117',
            borderRadius: '14px', border: '1px solid #1a1f35',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #0077b6, #00b4d8)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', color: 'white', fontSize: '14px' }}>🤖 AI Maintenance Assistant</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.75)' }}>Ask anything about your machines</div>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ height: '260px', overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #0077b6, #00b4d8)' : '#1a1f35',
                  padding: '9px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  maxWidth: '88%', fontSize: '12px', lineHeight: '1.5', color: 'white'
                }}>
                  {msg.text}
                </div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf: 'flex-start', background: '#1a1f35', padding: '9px 12px', borderRadius: '12px 12px 12px 2px', fontSize: '12px', color: '#888' }}>
                  🤔 Thinking...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Replies */}
            <div style={{ padding: '8px 10px', background: '#0a0e1a', borderTop: '1px solid #1a1f35' }}>
              <div style={{ fontSize: '10px', color: '#555', marginBottom: '6px' }}>Quick questions:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {QUICK_REPLIES.map((reply, i) => (
                  <button key={i} onClick={() => sendChat(reply)} disabled={chatLoading} style={{
                    background: '#1a1f35', border: '1px solid #2a2f45',
                    color: '#999', padding: '4px 9px', borderRadius: '20px',
                    cursor: chatLoading ? 'not-allowed' : 'pointer', fontSize: '10px',
                    transition: 'all 0.15s'
                  }}
                    onMouseOver={e => { if (!chatLoading) { e.target.style.background = '#00e5ff22'; e.target.style.color = '#00e5ff'; e.target.style.borderColor = '#00e5ff44'; } }}
                    onMouseOut={e => { e.target.style.background = '#1a1f35'; e.target.style.color = '#999'; e.target.style.borderColor = '#2a2f45'; }}
                  >{reply}</button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div style={{ padding: '9px', borderTop: '1px solid #1a1f35', display: 'flex', gap: '7px', background: '#0d1117' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask anything about machines..."
                style={{ ...inp, flex: 1, fontSize: '12px', padding: '8px 11px' }} />
              <button onClick={() => sendChat()} disabled={chatLoading} style={{
                background: chatLoading ? '#222' : 'linear-gradient(135deg, #0077b6, #00b4d8)',
                border: 'none', color: 'white', padding: '8px 13px',
                borderRadius: '7px', cursor: chatLoading ? 'not-allowed' : 'pointer', fontSize: '15px'
              }}>➤</button>
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button onClick={() => setChatOpen(!chatOpen)} style={{
          width: '54px', height: '54px', borderRadius: '50%',
          background: chatOpen ? '#1a1f35' : 'linear-gradient(135deg, #0077b6, #00b4d8)',
          border: 'none', cursor: 'pointer', fontSize: '24px',
          boxShadow: '0 4px 20px rgba(0,119,182,0.5)', transition: 'all 0.3s'
        }}>
          {chatOpen ? '✕' : '🤖'}
        </button>
      </div>
    </div>
  );
}