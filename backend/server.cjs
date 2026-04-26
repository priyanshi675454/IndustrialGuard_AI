const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const { Web3 } = require('web3');

const app = express();
app.use(cors());
app.use(express.json());

const web3 = new Web3('http://127.0.0.1:8545');

// ─────────────────────────────────────────────
//  CONTRACT CONFIG
//  After running: npx hardhat run scripts/deploy.js --network localhost
//  paste the printed address below
// ─────────────────────────────────────────────
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const contractABI = [
  {
    "inputs": [
      { "internalType": "string",  "name": "_machineId",   "type": "string"  },
      { "internalType": "uint256", "name": "_riskPercent", "type": "uint256" },
      { "internalType": "string",  "name": "_status",      "type": "string"  },
      { "internalType": "string",  "name": "_action",      "type": "string"  }
    ],
    "name": "logPrediction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalRecords",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
    "name": "getRecord",
    "outputs": [
      { "internalType": "string",  "name": "", "type": "string"  },
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "string",  "name": "", "type": "string"  },
      { "internalType": "string",  "name": "", "type": "string"  },
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const contract = new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);


const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '89894a7f-8980-48f5-8bbb-e9760a5b13b4';

// ─────────────────────────────────────────────
//  Smart fallback chat (used when no API key)
// ─────────────────────────────────────────────
const getFallbackResponse = (message, machineData) => {
  const msg      = message.toLowerCase();
  const critical = machineData.filter(m => m.status === 'CRITICAL');
  const warning  = machineData.filter(m => m.status === 'WARNING');

  if (msg.includes('critical') || msg.includes('most') || msg.includes('worst')) {
    if (critical.length > 0)
      return `🚨 Most critical: ${critical[0].name} (${critical[0].machine_id}) with ${critical[0].risk_percent}% failure risk. Immediate maintenance required!`;
    return '✅ No machines in critical status. All systems within acceptable range.';
  }
  if (msg.includes('maintenance') || msg.includes('first') || msg.includes('priority')) {
    if (critical.length > 0)
      return `🔧 Prioritize ${critical[0].name} — highest failure risk at ${critical[0].risk_percent}%. Inspect within 24 hours.`;
    if (warning.length > 0)
      return `⚠️ Schedule maintenance for ${warning[0].name} — ${warning[0].risk_percent}% risk. Plan inspection within the week.`;
    return '✅ All machines healthy! Continue routine maintenance schedule.';
  }
  if (msg.includes('risk') || msg.includes('percent') || msg.includes('explain'))
    return '📊 Risk % is calculated from 6 sensors: temperature, vibration, pressure, RPM, oil level, and hours run. 0–39% = Normal, 40–69% = Warning, 70–100% = Critical.';
  if (msg.includes('temperature') || msg.includes('temp') || msg.includes('hot'))
    return '🌡️ High temperature (above 85°C) causes lubricant breakdown, metal fatigue, and seal damage. Check cooling systems and reduce load.';
  if (msg.includes('blockchain') || msg.includes('immutable'))
    return '🔗 Blockchain creates a tamper-proof audit trail — every AI prediction is permanently recorded for ISO compliance and fraud prevention.';
  if (msg.includes('reduce') || msg.includes('lower') || msg.includes('prevent'))
    return '💡 Reduce failure risk: (1) Monitor oil weekly, (2) Check vibration after load changes, (3) Clean cooling monthly, (4) Preventive maintenance before 3000 hours.';
  if (msg.includes('vibration') || msg.includes('vibrate'))
    return '📳 High vibration (>50 Hz) indicates bearing wear or misalignment. Perform dynamic balancing and bearing inspection immediately.';
  if (msg.includes('oil') || msg.includes('lubric'))
    return '💧 Oil below 50% causes friction and heat. Top up, check for leaks, inspect seals. Oil analysis every 500 operating hours.';
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('help'))
    return '👋 Hello! I am IndustrialGuard AI Assistant. Ask me about machine health, maintenance priorities, risk levels, or sensor readings!';
  return `🤖 For best results, run a scan first so I have live machine data. I can explain risk levels, sensor readings, and maintenance priorities!`;
};

// ─────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await web3.eth.getBlockNumber();
    res.json({ blockchain: '✅ Connected', ai: '✅ Ready' });
  } catch (e) {
    res.json({ blockchain: '❌ Disconnected', ai: '✅ Ready', error: e.message });
  }
});

// Predict + log to blockchain
app.post('/api/analyze', async (req, res) => {
  try {
    let aiResult;

    // Call Python AI server
    try {
      const aiResponse = await axios.post('http://localhost:1000/predict', req.body, { timeout: 10000 });
      aiResult = aiResponse.data;
    } catch (aiError) {
      return res.status(500).json({ error: '❌ AI Server not running! Open terminal: cd AI && python predict.py' });
    }

    // Log to blockchain
    try {
      const accounts  = await web3.eth.getAccounts();
      const riskInt   = Math.round(aiResult.risk_percent);
      await contract.methods.logPrediction(
        aiResult.machine_id,
        riskInt,
        aiResult.status,
        aiResult.action
      ).send({ from: accounts[0], gas: 300000 });

      const totalRecords = await contract.methods.getTotalRecords().call();
      return res.json({
        ...aiResult,
        blockchain_logged: true,
        total_blockchain_records: Number(totalRecords),
        message: '✅ Prediction logged on blockchain!'
      });
    } catch (blockchainError) {
      console.error('Blockchain error:', blockchainError.message);
      // Still return AI result even if blockchain fails
      return res.json({
        ...aiResult,
        blockchain_logged: false,
        blockchain_error: 'Check: is hardhat node running? Did you redeploy and update CONTRACT_ADDRESS?',
        total_blockchain_records: 0
      });
    }
  } catch (error) {
    console.error('analyze error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get all blockchain logs
app.get('/api/logs', async (req, res) => {
  try {
    const total = await contract.methods.getTotalRecords().call();
    const logs  = [];
    for (let i = 0; i < Number(total); i++) {
      const record = await contract.methods.getRecord(i).call();
      logs.push({
        machineId:  record[0],
        riskPercent: Number(record[1]),
        status:     record[2],
        action:     record[3],
        timestamp:  new Date(Number(record[4]) * 1000).toISOString(),
        recordedBy: record[5]
      });
    }
    res.json({ total: Number(total), logs });
  } catch (error) {
    res.json({ total: 0, logs: [], error: 'Blockchain not connected or contract not deployed' });
  }
});

// AI Chat 
app.post('/api/chat', async (req, res) => {
  try {
    const { message, machineData } = req.body;

    // FIX: Check if key is a real key (not placeholder) — use fallback if not set
    if (!CLAUDE_API_KEY || CLAUDE_API_KEY === '89894a7f-8980-48f5-8bbb-e9760a5b13b4') {
      return res.json({ reply: getFallbackResponse(message, machineData || []) });
    }

    // Try Claude API
    try {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model:      'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `You are IndustrialGuard AI — an expert industrial maintenance assistant.
Machine data: ${JSON.stringify(machineData || [])}
Question: ${message}
Answer in 2-3 clear sentences. Be specific and practical. Reference actual machine data if available.`
        }]
      }, {
        headers: {
          'x-api-key':          CLAUDE_API_KEY,
          'anthropic-version':  '2023-06-01',
          'content-type':       'application/json'
        },
        timeout: 15000
      });
      res.json({ reply: response.data.content[0].text });
    } catch (apiError) {
      console.error('Claude API error:', apiError.response?.data || apiError.message);
      res.json({ reply: getFallbackResponse(message, machineData || []) });
    }
  } catch (error) {
    res.status(500).json({ error: 'Chat error: ' + error.message });
  }
});

app.listen(3001, () => {
  console.log('🚀 Backend running on port 3001');
  console.log('📡 Blockchain: http://127.0.0.1:8545');
  console.log('🤖 AI Server: http://localhost:1000');
  console.log(`🔑 Claude API: ${CLAUDE_API_KEY === 'YOUR_KEY_HERE' ? '⚠️ Not set (using smart fallback)' : '✅ Configured'}`);
});
