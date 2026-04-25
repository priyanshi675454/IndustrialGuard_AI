const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Web3 } = require('web3');

const app = express();
app.use(cors());
app.use(express.json());

const web3 = new Web3('http://127.0.0.1:8545');

const contractABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "_machineId", "type": "string"},
      {"internalType": "uint256", "name": "_riskPercent", "type": "uint256"},
      {"internalType": "string", "name": "_status", "type": "string"},
      {"internalType": "string", "name": "_action", "type": "string"}
    ],
    "name": "logPrediction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalRecords",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
    "name": "getRecord",
    "outputs": [
      {"internalType": "string", "name": "", "type": "string"},
      {"internalType": "uint256", "name": "", "type": "uint256"},
      {"internalType": "string", "name": "", "type": "string"},
      {"internalType": "string", "name": "", "type": "string"},
      {"internalType": "uint256", "name": "", "type": "uint256"},
      {"internalType": "address", "name": "", "type": "address"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// ⚠️ PASTE YOUR NEW CONTRACT ADDRESS HERE AFTER REDEPLOYING
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const contract = new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);

// Smart fallback chat responses
const getFallbackResponse = (message, machineData) => {
  const msg = message.toLowerCase();
  const critical = machineData.filter(m => m.status === 'CRITICAL');
  const warning = machineData.filter(m => m.status === 'WARNING');

  if (msg.includes('critical') || msg.includes('most') || msg.includes('worst')) {
    if (critical.length > 0) {
      return `🚨 The most critical machine is ${critical[0].name} (${critical[0].machine_id}) with ${critical[0].risk_percent}% failure risk. Immediate maintenance is required to prevent costly breakdown.`;
    }
    return '✅ Great news! No machines are currently in critical status. All systems are operating within acceptable parameters.';
  }
  if (msg.includes('maintenance') || msg.includes('first') || msg.includes('priority')) {
    if (critical.length > 0) {
      return `🔧 Prioritize ${critical[0].name} immediately — it has the highest failure risk at ${critical[0].risk_percent}%. Schedule inspection within 24 hours to prevent unplanned downtime.`;
    }
    if (warning.length > 0) {
      return `⚠️ Schedule maintenance for ${warning[0].name} soon — it shows ${warning[0].risk_percent}% risk. Plan inspection within the next week to stay ahead of potential failures.`;
    }
    return '✅ All machines are healthy! Perform routine maintenance checks on schedule — no urgent action required.';
  }
  if (msg.includes('risk') || msg.includes('percent') || msg.includes('explain')) {
    return '📊 Risk % is calculated by our AI model using 6 sensor inputs: temperature, vibration, pressure, RPM, oil level, and hours run. 0-39% = Normal, 40-69% = Warning (schedule soon), 70-100% = Critical (act immediately).';
  }
  if (msg.includes('temperature') || msg.includes('temp') || msg.includes('hot')) {
    return '🌡️ High temperature (above 85°C) is the #1 cause of industrial failures. It causes lubricant breakdown, metal fatigue, and seal damage. Check cooling systems, clean filters, and reduce load if temperature exceeds safe limits.';
  }
  if (msg.includes('blockchain') || msg.includes('why blockchain') || msg.includes('immutable')) {
    return '🔗 Blockchain creates an immutable audit trail — every AI prediction is permanently recorded and cannot be altered. This ensures compliance, prevents fraud, and provides tamper-proof maintenance history for ISO audits.';
  }
  if (msg.includes('reduce') || msg.includes('lower') || msg.includes('improve') || msg.includes('prevent')) {
    return '💡 To reduce failure risk: (1) Monitor oil levels weekly, (2) Check vibration after load changes, (3) Clean cooling systems monthly, (4) Schedule preventive maintenance before 3000 hours of operation.';
  }
  if (msg.includes('vibration') || msg.includes('vibrate')) {
    return '📳 High vibration (above 50 Hz) indicates bearing wear, misalignment, or imbalance. Left unchecked, it causes catastrophic failure. Perform dynamic balancing and bearing inspection immediately if vibration exceeds safe limits.';
  }
  if (msg.includes('oil') || msg.includes('lubric')) {
    return '💧 Oil level below 50% significantly increases friction and heat, leading to accelerated wear. Check for leaks, top up with correct grade lubricant, and inspect seals. Schedule oil analysis every 500 operating hours.';
  }
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('help')) {
    return '👋 Hello! I am IndustrialGuard AI Assistant. I can help you with machine health analysis, maintenance priorities, risk explanations, and sensor data interpretation. What would you like to know?';
  }
  return `🤖 I analyzed your question about "${message}". For best results, run an AI Scan first so I have live machine data to reference. I can answer questions about machine status, maintenance priorities, risk levels, and sensor readings!`;
};

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await web3.eth.getBlockNumber();
    res.json({ blockchain: '✅ Connected', ai: '✅ Ready' });
  } catch (e) {
    res.json({ blockchain: '❌ Disconnected', error: e.message });
  }
});

// Predict + Log to Blockchain
app.post('/api/analyze', async (req, res) => {
  try {
    let aiResult;
    try {
      const aiResponse = await axios.post('http://localhost:1000/predict', req.body, { timeout: 10000 });
      aiResult = aiResponse.data;
    } catch (aiError) {
      return res.status(500).json({ error: '❌ AI Server not running! Open terminal: cd ai && python predict.py' });
    }

    try {
      const accounts = await web3.eth.getAccounts();
      const riskInt = Math.round(aiResult.risk_percent);
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
      return res.json({
        ...aiResult,
        blockchain_logged: false,
        blockchain_error: 'Redeploy contract — hardhat node restarted',
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
    const logs = [];
    for (let i = 0; i < Number(total); i++) {
      const record = await contract.methods.getRecord(i).call();
      logs.push({
        machineId: record[0],
        riskPercent: Number(record[1]),
        status: record[2],
        action: record[3],
        timestamp: new Date(Number(record[4]) * 1000).toISOString(),
        recordedBy: record[5]
      });
    }
    res.json({ total: Number(total), logs });
  } catch (error) {
    res.json({ total: 0, logs: [], error: 'Blockchain not connected' });
  }
});

// AI Chat — Claude API with smart fallback
app.post('/api/chat', async (req, res) => {
  try {
    const { message, machineData } = req.body;
    const CLAUDE_API_KEY = '89894a7f-8980-48f5-8bbb-e9760a5b13b4';

    if (CLAUDE_API_KEY === '89894a7f-8980-48f5-8bbb-e9760a5b13b4') {
      return res.json({ reply: getFallbackResponse(message, machineData || []) });
    }

    try {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `You are IndustrialGuard AI — an expert industrial maintenance assistant.
Machine data: ${JSON.stringify(machineData || [])}
Question: ${message}
Answer in 2-3 clear sentences. Be specific, practical, and reference actual machine data if available.`
        }]
      }, {
        headers: {
          'x-api-key':'89894a7f-8980-48f5-8bbb-e9760a5b13b4',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 15000
      });
      res.json({ reply: response.data.content[0].text });
    } catch (apiError) {
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
});