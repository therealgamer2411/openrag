require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000
});

const MAX_MEMORY_RECORDS = 5000;

const mockDB = {
    api_clients: {},
    users: {}, 
    transactions: [],
    stats: { totalCowries: 0, activeNodes: 0 }  
};

const DEFAULT_DEV_KEY = process.env.DEV_API_KEY || "dev_key_local_only";
if (process.env.DEV_API_KEY) {
    mockDB.api_clients[process.env.DEV_API_KEY] = { 
        id: "dev_1", 
        email: "admin@openrag.africa", 
        balance_usd: 100.00 
    };
} else {
    mockDB.api_clients[DEFAULT_DEV_KEY] = { 
        id: "dev_1", 
        email: "admin@openrag.africa", 
        balance_usd: 100.00 
    };
}

const METERED_API_KEY = process.env.METERED_API_KEY;

if (!METERED_API_KEY) {
    console.warn("[!] Warning: METERED_API_KEY not found in environment.");
}

let cachedIceServers = null;
let lastIceFetchTime = 0;
const ICE_CACHE_DURATION = 1000 * 60 * 60 * 6;

async function getIceServers() {
    const NOW = Date.now();
    if (cachedIceServers && (NOW - lastIceFetchTime < ICE_CACHE_DURATION)) {
        return cachedIceServers;
    }
    if (!METERED_API_KEY) {
        return [];
    }
    try {
        const response = await fetch(`https://openrag-grid.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`);
        const iceServers = await response.json();
        cachedIceServers = iceServers.map(server => {
            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
            const cleanUrls = urls.map(u => {
                if (u.startsWith('turn') && !u.includes('transport=')) return `${u}?transport=tcp`;
                return u;
            });
            return { ...server, urls: cleanUrls };
        });
        lastIceFetchTime = NOW;
        return cachedIceServers;
    } catch (e) { 
        console.error("[!] Metered API Error:", e.message);
        return cachedIceServers || []; 
    }
}

const PRICE_PER_MB_USD = 0.004; 
const WORKER_SHARE = 0.25;
const COWRIES_PER_DOLLAR = 1000;

let workers = {}; 
let developers = {}; 

const taskTracker = new Map();

setInterval(() => {
    const now = Date.now();
    const cutoff = now - (5 * 60 * 1000);
    for (const [id, time] of taskTracker.entries()) {
        if (time < cutoff) taskTracker.delete(id);
    }
}, 60000);

function trimRecords() {
    if (mockDB.transactions.length > MAX_MEMORY_RECORDS) {
        mockDB.transactions = mockDB.transactions.slice(-MAX_MEMORY_RECORDS / 2);
    }
}

io.on('connection', async (socket) => {
    console.log(`⚡ [Network] New connection detected: ${socket.id}`);

    socket.emit('STATS_UPDATE', mockDB.stats);

    socket.on('REGISTER_WORKER', (data) => {
        let wallet = data?.wallet;
        
        if (!wallet || typeof wallet !== 'string') {
            wallet = "Guest_" + socket.id.substring(0, 5);
        } else {
            wallet = wallet.trim();
            if (wallet.length < 3 || wallet.length > 64) {
                socket.emit('ERROR', { msg: "Invalid wallet format (3-64 chars)" });
                return;
            }
            if (/[<>\"']/.test(wallet)) {
                socket.emit('ERROR', { msg: "Invalid characters in wallet" });
                return;
            }
        }

        workers[socket.id] = wallet;
        mockDB.stats.activeNodes = Object.keys(workers).length;  
        
        console.log(`📱 [Grid] Worker Node Ready: ${socket.id} | Wallet: ${wallet}`);
        
        if (!wallet.startsWith("Guest")) {
            if (!mockDB.users[wallet]) {
                mockDB.users[wallet] = { cowries_balance: 0 };
            }
            socket.emit('BALANCE_UPDATE', { balance: mockDB.users[wallet].cowries_balance });
        }

        io.emit('STATS_UPDATE', mockDB.stats);
    });

    socket.on('FIND_NODE', () => {
        if (!developers[socket.id]) {
            return socket.emit('ERROR', { msg: "Authentication required" });
        }

        const ids = Object.keys(workers);
        if (ids.length > 0) {
            const target = ids[Math.floor(Math.random() * ids.length)];
            console.log(`🔄 [Routing] Assigned task to Worker: ${target}`);
            socket.emit('NODE_FOUND', { targetId: target });
        } else {
            console.log(`⚠️ [Routing] No OpenRAG Nodes available.`);
            socket.emit('ERROR', { msg: "No OpenRAG Nodes available in the grid." });
        }
    });

    socket.on('SIGNAL', (data) => {
        if (!data || !data.target || !data.signal) return;
        io.to(data.target).emit('SIGNAL', { sender: socket.id, signal: data.signal });
    });

    socket.on('TASK_COMPLETED', (data) => {
        const { sizeBytes } = data;
        const workerWallet = workers[socket.id]; 
        
        if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > (50 * 1024 * 1024)) {
            console.log(`🚨 [Security] Invalid Task Payload from ${socket.id}`);
            return;
        }

        if (!workerWallet || workerWallet.startsWith("Guest")) return;

        const now = Date.now();
        const lastTask = taskTracker.get(socket.id);
        if (lastTask && (now - lastTask) < 3000) {
            console.log(`🛡️ [RateLimit] Ignoring rapid task from ${socket.id}`);
            return;
        }
        taskTracker.set(socket.id, now);

        const sizeMB = sizeBytes / (1024 * 1024);
        const totalCost = sizeMB * PRICE_PER_MB_USD; 
        const workerReward = totalCost * WORKER_SHARE;
        const cowriesEarned = Math.floor(workerReward * COWRIES_PER_DOLLAR);

        if (cowriesEarned <= 0) return;

        if (mockDB.users[workerWallet]) {
            mockDB.users[workerWallet].cowries_balance += cowriesEarned;
            mockDB.stats.totalCowries += cowriesEarned;  
            
            socket.emit('BALANCE_UPDATE', { 
                balance: mockDB.users[workerWallet].cowries_balance, 
                earned: cowriesEarned 
            });
            
            mockDB.transactions.push({
                wallet_id: workerWallet, 
                amount: workerReward, 
                source_url: "Compute Reward", 
                created_at: new Date()
            });

            trimRecords();

            io.emit('STATS_UPDATE', mockDB.stats);

            console.log(`🪙 [Economy] +${cowriesEarned} Cowries to ${workerWallet}. Total: ${mockDB.users[workerWallet].cowries_balance}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 [Grid] Node Disconnected: ${socket.id}`);
        delete workers[socket.id];
        delete developers[socket.id];
        taskTracker.delete(socket.id);

        mockDB.stats.activeNodes = Object.keys(workers).length;
        io.emit('STATS_UPDATE', mockDB.stats);
    });

    // ------------------------------------------
    // ⏳ بعد تأمين الـ Listeners، نجلب البيانات ونتحقق من الهوية
    // ------------------------------------------
    const iceServers = await getIceServers();
    const apiKey = socket.handshake.auth.token;
    
    if (apiKey) {
        const client = mockDB.api_clients[apiKey];
        
        if (!client || client.balance_usd <= 0) {
            console.log(`⛔ Auth Failed or Zero Balance for: ${apiKey.substring(0, 8)}...`);
            socket.emit('ERROR', { msg: "Authentication Failed or Insufficient Balance" });
            return socket.disconnect(); 
        }
        
        developers[socket.id] = client;
        console.log(`👨‍💻 [Grid] Developer Ready: ${client.email}`);
    }

    socket.emit('CONFIG', { iceServers });
});

process.on('SIGTERM', () => {
    console.log('\n[!] SIGTERM received. Shutting down gracefully...');
    io.close(() => {
        server.close(() => {
            console.log('[✓] Server closed. Goodbye.');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('\n[!] SIGINT received. Shutting down gracefully...');
    io.close(() => {
        server.close(() => {
            console.log('[✓] Server closed. Goodbye.');
            process.exit(0);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 OpenRAG Federation Server`);
    console.log(`🌍 Running on Port: ${PORT}`);
    console.log(`🔒 Security: Rate Limiting + Input Validation Enabled`);
    console.log(`💾 Storage: In-Memory (Free Demo Mode)`);
    console.log(`🐚 Economy: Cowries — Africa's Resource Credit System`);
    console.log(`📝 Note: No cash redemption. Credits circulate within the network.`);
    console.log(`========================================\n`);
});
