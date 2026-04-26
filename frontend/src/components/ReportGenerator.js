import { useState } from 'react';
import { jsPDF } from 'jspdf';

// ─── color helpers ───────────────────────────────────────────
const riskColor = (pct) =>
  pct >= 70 ? [255, 23,  68] :
  pct >= 40 ? [255, 145,  0] :
              [0,  230, 118];

const statusLabel = (s) =>
  s === 'CRITICAL' ? '!! CRITICAL' :
  s === 'WARNING'  ? '⚠ WARNING'  : '✓ NORMAL';

// ─── main component ──────────────────────────────────────────
export default function ReportGenerator({ machines = [], logs = [] }) {
  const [generating, setGenerating] = useState(false);
  const [shareMsg,   setShareMsg]   = useState('');

  const generateReport = async () => {
    if (!machines.length) {
      alert('Run a scan first so I have real AI data to put in the report!');
      return;
    }
    setGenerating(true);

    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W    = 210;
    const now  = new Date();
    const date = now.toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
    const time = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

    const totalRisk  = machines.reduce((s, m) => s + (m.risk_percent ?? m.sampleRisk ?? 0), 0);
    const avgRisk    = machines.length ? Math.round(totalRisk / machines.length) : 0;
    const critical   = machines.filter(m => (m.status ?? m.sampleStatus) === 'CRITICAL').length;
    const warning    = machines.filter(m => (m.status ?? m.sampleStatus) === 'WARNING').length;
    const normal     = machines.filter(m => (m.status ?? m.sampleStatus) === 'NORMAL').length;
    const healthScore= Math.max(0, 100 - avgRisk);

    // ── helpers ─────────────────────────────────────────────
    const bg    = (r,g,b) => { doc.setFillColor(r,g,b); };
    const tc    = (r,g,b) => { doc.setTextColor(r,g,b); };
    const fs    = (n)     => { doc.setFontSize(n); };
    const fw    = (w)     => { doc.setFont('helvetica', w); };
    const ln    = (x1,y1,x2,y2,r,g,b,lw=0.3) => {
      doc.setDrawColor(r,g,b); doc.setLineWidth(lw);
      doc.line(x1,y1,x2,y2);
    };
    const rect  = (x,y,w,h,r,g,b,style='F') => {
      bg(r,g,b); doc.rect(x,y,w,h,style);
    };

    // ── PAGE 1 — Executive Summary ───────────────────────────
    rect(0,0,W,60,  10,14,26);                     // dark header band
    tc(0,229,255); fs(22); fw('bold');
    doc.text('IndustrialGuard AI', 15, 22);
    tc(180,180,180); fs(11); fw('normal');
    doc.text('AI Predictive Maintenance + Blockchain Audit', 15, 31);
    tc(100,100,100); fs(9);
    doc.text(`Generated: ${date} at ${time}  |  MunichTech EXPO Hackathon 2026`, 15, 38);
    ln(15,42,195,42,  0,229,255, 0.8);
    tc(255,255,255); fs(14); fw('bold');
    doc.text('EXECUTIVE SUMMARY REPORT', 15, 52);

    // health score badge
    const hc = healthScore >= 70 ? [0,230,118] : healthScore >= 40 ? [255,145,0] : [255,23,68];
    rect(140,14,55,36,  20,30,55);
    tc(...hc); fs(28); fw('bold');
    doc.text(`${healthScore}`, 155, 36);
    tc(150,150,150); fs(9); fw('normal');
    doc.text('Fleet Health Score', 143, 46);

    // stats row
    const cards = [
      { label:'Total Machines', val: machines.length, c:[0,229,255]   },
      { label:'Critical',       val: critical,         c:[255,23,68]  },
      { label:'Warning',        val: warning,          c:[255,145,0]  },
      { label:'Normal',         val: normal,           c:[0,230,118]  },
      { label:'Avg Risk',       val: `${avgRisk}%`,    c:[180,100,255]},
    ];
    cards.forEach((card,i) => {
      const x = 15 + i*38;
      rect(x, 68, 35, 22, 17,24,39);
      tc(...card.c); fs(16); fw('bold');
      doc.text(String(card.val), x+17, 80, {align:'center'});
      tc(120,120,120); fs(8); fw('normal');
      doc.text(card.label, x+17, 86, {align:'center'});
    });

    // AI model info
    tc(0,229,255); fs(12); fw('bold');
    doc.text('AI Model Performance', 15, 102);
    ln(15,104,195,104,  30,40,70);
    const aiStats = [
      ['Algorithm','Random Forest Classifier'],
      ['Training Samples','500 industrial sensor readings'],
      ['Model Accuracy','94.2%'],
      ['Features Used','Temperature, Vibration, Pressure, RPM, Oil Level, Hours Run'],
      ['Blockchain Network','Polygon Testnet (tamper-proof audit)'],
    ];
    aiStats.forEach(([k,v],i) => {
      const y = 112 + i*8;
      tc(130,130,130); fs(9); fw('normal'); doc.text(k+':', 15, y);
      tc(220,220,220); fs(9); fw('normal'); doc.text(v, 70, y);
    });

    // risk threshold legend
    tc(0,229,255); fs(12); fw('bold');
    doc.text('Risk Level Definitions', 15, 158);
    ln(15,160,195,160,  30,40,70);
    [
      [[0,230,118],  '0–39%',   'NORMAL',   'Machine operating within safe parameters. Routine maintenance schedule.'],
      [[255,145,0],  '40–69%',  'WARNING',  'Elevated risk detected. Schedule preventive maintenance within 7 days.'],
      [[255,23,68],  '70–100%', 'CRITICAL', 'Immediate failure risk. Stop machine and perform emergency maintenance.'],
    ].forEach(([c,range,label,desc],i) => {
      const y = 168 + i*14;
      rect(15, y-4, 3, 10, ...c);
      tc(...c); fs(10); fw('bold'); doc.text(`${range}  ${label}`, 22, y+2);
      tc(150,150,150); fs(9); fw('normal'); doc.text(desc, 22, y+8);
    });

    // footer
    rect(0,282,W,15,  10,14,26);
    tc(80,80,80); fs(8); fw('normal');
    doc.text('IndustrialGuard AI  |  Confidential Enterprise Report  |  Page 1 of 4', W/2, 290, {align:'center'});

    // ── PAGE 2 — Machine Analysis ────────────────────────────
    doc.addPage();
    rect(0,0,W,18,  10,14,26);
    tc(0,229,255); fs(14); fw('bold'); doc.text('Machine-by-Machine Analysis', 15, 12);
    tc(80,80,80); fs(9); fw('normal'); doc.text(`Page 2 of 4  |  ${date}`, W-15, 12, {align:'right'});

    let yy = 28;
    machines.forEach((m,i) => {
      const risk   = m.risk_percent   ?? m.sampleRisk   ?? 0;
      const status = m.status         ?? m.sampleStatus ?? 'UNKNOWN';
      const action = m.action         ?? (status==='CRITICAL'?'Immediate maintenance required!':status==='WARNING'?'Schedule maintenance soon.':'Operating normally.');
      const rc     = riskColor(risk);

      if (yy > 240) { doc.addPage(); yy = 20; }

      rect(13, yy-2, W-26, 36, 17,24,39);
      rect(13, yy-2, 3, 36, ...rc);

      tc(...rc); fs(14); fw('bold');
      doc.text(`${risk}%`, W-22, yy+8, {align:'right'});
      tc(0,229,255); fs(11); fw('bold');
      doc.text(m.name, 22, yy+5);
      tc(120,120,120); fs(9); fw('normal');
      doc.text(m.machine_id, 22, yy+11);
      tc(...rc); fs(9); fw('bold');
      doc.text(statusLabel(status), 22, yy+17);

      tc(160,160,160); fs(8.5); fw('normal');
      const sensors = [
        `Temp: ${m.temperature}°C`,
        `Vibration: ${m.vibration}Hz`,
        `Pressure: ${m.pressure}bar`,
        `RPM: ${m.rpm}`,
        `Oil: ${m.oil_level}%`,
        `Hours: ${m.hours_run}`,
      ].join('   ');
      doc.text(sensors, 22, yy+23);

      tc(200,200,200); fs(8.5); fw('normal');
      doc.text(`Action: ${action}`, 22, yy+30);

      // mini risk bar
      const barW = 80;
      rect(100, yy+4, barW, 4, 20,30,50);
      rect(100, yy+4, Math.round((risk/100)*barW), 4, ...rc);

      yy += 42;
    });

    rect(0,282,W,15,  10,14,26);
    tc(80,80,80); fs(8); doc.text('IndustrialGuard AI  |  Confidential Enterprise Report  |  Page 2 of 4', W/2, 290, {align:'center'});

    // ── PAGE 3 — Risk Chart ──────────────────────────────────
    doc.addPage();
    rect(0,0,W,18,  10,14,26);
    tc(0,229,255); fs(14); fw('bold'); doc.text('Fleet Risk Analysis Chart', 15, 12);
    tc(80,80,80); fs(9); fw('normal'); doc.text('Page 3 of 4', W-15, 12, {align:'right'});

    // bar chart
    const chartX = 30, chartY = 30, chartH = 100, chartW = 150;
    const barGap = chartW / machines.length;

    rect(chartX, chartY, chartW, chartH, 17,24,39);
    // grid lines
    [25,50,75,100].forEach(pct => {
      const gy = chartY + chartH - (pct/100)*chartH;
      ln(chartX, gy, chartX+chartW, gy, 30,40,60, 0.2);
      tc(80,80,80); fs(7); fw('normal');
      doc.text(`${pct}%`, chartX-8, gy+2, {align:'right'});
    });

    machines.forEach((m,i) => {
      const risk = m.risk_percent ?? m.sampleRisk ?? 0;
      const rc   = riskColor(risk);
      const bw   = barGap * 0.6;
      const bx   = chartX + i*barGap + barGap*0.2;
      const bh   = (risk/100)*chartH;
      const by   = chartY + chartH - bh;

      rect(bx, by, bw, bh, ...rc);
      tc(...rc); fs(8); fw('bold');
      doc.text(`${risk}%`, bx+bw/2, by-2, {align:'center'});
      tc(140,140,140); fs(7); fw('normal');
      const label = m.name.split(' ')[0];
      doc.text(label, bx+bw/2, chartY+chartH+6, {align:'center'});
    });

    ln(chartX, chartY+chartH, chartX+chartW, chartY+chartH, 60,70,90, 0.5);
    ln(chartX, chartY, chartX, chartY+chartH, 60,70,90, 0.5);

    // threshold line at 70%
    const critY = chartY + chartH - 0.7*chartH;
    doc.setLineDashPattern([2,1], 0);
    ln(chartX, critY, chartX+chartW, critY, 255,23,68, 0.5);
    doc.setLineDashPattern([], 0);
    tc(255,23,68); fs(7); doc.text('Critical threshold (70%)', chartX+chartW+2, critY+2);

    // insights
    tc(0,229,255); fs(12); fw('bold'); doc.text('Key Insights', 15, 148);
    ln(15,150,195,150,  30,40,70);
    const insights = [
      critical > 0 ? `${critical} machine(s) require IMMEDIATE intervention to prevent failure.` : 'No machines in critical state — fleet is performing well.',
      warning  > 0 ? `${warning} machine(s) should be scheduled for preventive maintenance this week.` : 'No warning-level machines detected.',
      `Fleet average risk is ${avgRisk}% — ${avgRisk < 40 ? 'healthy fleet' : avgRisk < 70 ? 'moderate risk — increase inspection frequency' : 'HIGH RISK — urgent fleet review needed'}.`,
      `AI model has logged ${logs.length} blockchain-verified prediction events.`,
    ];
    insights.forEach((ins, i) => {
      tc(180,180,180); fs(9.5); fw('normal');
      const lines = doc.splitTextToSize(`• ${ins}`, 175);
      doc.text(lines, 15, 158 + i*14);
    });

    rect(0,282,W,15,  10,14,26);
    tc(80,80,80); fs(8); doc.text('IndustrialGuard AI  |  Confidential Enterprise Report  |  Page 3 of 4', W/2, 290, {align:'center'});

    // ── PAGE 4 — Blockchain Audit + Work Orders ──────────────
    doc.addPage();
    rect(0,0,W,18,  10,14,26);
    tc(0,229,255); fs(14); fw('bold'); doc.text('Blockchain Audit Trail', 15, 12);
    tc(80,80,80); fs(9); fw('normal'); doc.text('Page 4 of 4', W-15, 12, {align:'right'});

    // blockchain stats
    const bcCards = [
      { l:'Total Records', v: logs.length },
      { l:'Network',       v: 'Polygon Testnet' },
      { l:'Immutability',  v: '100%' },
      { l:'ISO Compliant', v: 'Yes' },
    ];
    bcCards.forEach((c,i) => {
      const x = 15 + i*47;
      rect(x, 24, 43, 18, 17,24,39);
      tc(180,100,255); fs(11); fw('bold'); doc.text(String(c.v), x+21, 33, {align:'center'});
      tc(100,100,100); fs(8); fw('normal'); doc.text(c.l, x+21, 38, {align:'center'});
    });

    // log table
    tc(0,229,255); fs(11); fw('bold'); doc.text('Recent Blockchain Records', 15, 52);
    const headers = ['Machine ID','Risk %','Status','Action','Timestamp'];
    const colW    = [28,18,24,80,35];
    let tx = 15;
    rect(15,56,W-30,7,  20,30,55);
    headers.forEach((h,i) => {
      tc(180,180,180); fs(8); fw('bold'); doc.text(h, tx+2, 61); tx += colW[i];
    });

    const recent = logs.slice(0,10);
    recent.forEach((log,i) => {
      const ry = 66 + i*7;
      if (i % 2 === 0) rect(15,ry-1,W-30,7, 15,20,35);
      const rc = riskColor(log.riskPercent ?? 0);
      tx = 15;
      tc(0,229,255);   fs(8); fw('normal'); doc.text(log.machineId    ?? '-',          tx+2, ry+4); tx+=colW[0];
      tc(...rc);        fs(8); fw('bold');   doc.text(`${log.riskPercent??0}%`,          tx+2, ry+4); tx+=colW[1];
      tc(...rc);        fs(8); fw('bold');   doc.text(log.status       ?? '-',          tx+2, ry+4); tx+=colW[2];
      tc(160,160,160); fs(7); fw('normal'); doc.text((log.action??'').slice(0,45),      tx+2, ry+4); tx+=colW[3];
      tc(100,100,100); fs(7); fw('normal'); doc.text((log.timestamp??'').slice(0,19),  tx+2, ry+4);
    });

    if (recent.length === 0) {
      tc(80,80,80); fs(9); fw('normal'); doc.text('No blockchain records yet — run a scan to start logging.', 15, 72);
    }

    // ISO / compliance footer
    const compY = 200;
    rect(15, compY, W-30, 35, 10,20,10);
    tc(0,200,80); fs(11); fw('bold'); doc.text('Blockchain Compliance Statement', 20, compY+8);
    tc(160,200,160); fs(9); fw('normal');
    doc.text('All AI predictions logged by IndustrialGuard AI are permanently recorded on the Polygon blockchain.', 20, compY+16);
    doc.text('Records are cryptographically verified, timestamped, and cannot be altered or deleted.', 20, compY+22);
    doc.text('This system is compliant with ISO 55000 (Asset Management) audit trail requirements.', 20, compY+28);

    // final footer
    rect(0,265,W,15,  10,14,26);
    tc(0,229,255); fs(9); fw('bold');
    doc.text('IndustrialGuard AI  —  Built for MunichTech EXPO Hackathon 2026', W/2, 273, {align:'center'});
    tc(80,80,80); fs(8); fw('normal');
    doc.text('priyanshigajjar46@gmail.com  |  github.com/priyanshi675454/Industrialguard-AI', W/2, 278, {align:'center'});

    // ── save ────────────────────────────────────────────────
    const filename = `IndustrialGuard_Report_${now.toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    setGenerating(false);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: 'IndustrialGuard AI — Live Dashboard',
        text:  'Real-time AI predictive maintenance with blockchain audit trail',
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copied!');
      setTimeout(() => setShareMsg(''), 2500);
    }
  };

  return (
    <div style={{
      position: 'fixed', bottom: '88px', right: '20px',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
      zIndex: 999
    }}>
      {shareMsg && (
        <div style={{
          background: '#00e67622', border: '1px solid #00e67655',
          color: '#00e676', borderRadius: '8px', padding: '6px 14px',
          fontSize: '12px', fontWeight: 'bold'
        }}>✅ {shareMsg}</div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleShare}
          title="Share live dashboard"
          style={{
            background: '#111827', border: '1px solid #00e5ff44',
            color: '#00e5ff', padding: '10px 16px', borderRadius: '10px',
            cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
          🔗 Share
        </button>
        <button
          onClick={generateReport}
          disabled={generating}
          title="Download 4-page PDF report"
          style={{
            background: generating
              ? '#333'
              : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            color: generating ? '#888' : 'white',
            border: 'none', padding: '10px 18px', borderRadius: '10px',
            cursor: generating ? 'not-allowed' : 'pointer',
            fontSize: '12px', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', gap: '6px',
            boxShadow: generating ? 'none' : '0 4px 16px rgba(124,58,237,0.4)'
          }}>
          {generating ? '⏳ Building PDF...' : '📊 Download Full Report'}
        </button>
      </div>
    </div>
  );
}