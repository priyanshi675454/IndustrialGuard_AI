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

// ⚠️ PASTE YOUR CONTRACT ADDRESS HERE
const CONTRACT_ADDRESS = '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512';
const contract = new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);

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
      return res.status(500).json({ error: '❌ AI Server not running! Start: cd ai && python predict.py' });
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
    } catch (blockchainError) {
      return res.json({
        ...aiResult,
        blockchain_logged: false,
        blockchain_error: '❌ Redeploy contract',
        total_blockchain_records: 0
      });
    }

    const totalRecords = await contract.methods.getTotalRecords().call();
    res.json({
      ...aiResult,
      blockchain_logged: true,
      total_blockchain_records: Number(totalRecords),
      message: '✅ Prediction logged on blockchain!'
    });

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

// AI Chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, machineData } = req.body;
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are an industrial AI maintenance expert for IndustrialGuard AI system.
Current machine data: ${JSON.stringify(machineData || [])}
User question: ${message}
Answer in 2-3 sentences. Be specific and practical.`
      }]
    }, {
      headers: {
        'x-api-key': 'PASTE_YOUR_CLAUDE_API_KEY_HERE',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    });
    res.json({ reply: response.data.content[0].text });
  } catch (error) {
    res.status(500).json({ error: 'Chat error: ' + error.message });
  }
});

app.listen(3001, () => {
  console.log('🚀 Backend running on port 3001');
  console.log('📡 Connecting to blockchain at http://127.0.0.1:8545');
  console.log('🤖 AI server expected at http://localhost:1000');
});