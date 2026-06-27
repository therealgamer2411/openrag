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

// Mock DB
const mockDB = {
    api_clients: {},
    users: {}, 
    transactions: [],
    stats: { totalCowries: 0, activeNodes: 0 }
};

const DEFAULT_DEV_KEY = process.env.DEV_API_KEY || "Africa_Grid_Secret_Key_2026_xyz";
mockDB.api_clients[DEFAULT_DEV_KEY] = { 
    id: "dev_1", 
    email: "admin@openrag.africa", 
    balance_usd: 100.00 
};

// Economy
const PRICE_PER_MB_USD = 0.004; 
const WORKER_SHARE = 0.25;
const COWRIES_PER_DOLLAR = 1000;

let workers = {}; 
let developers = {}; 
const taskTracker = new Map();

// Rate limiting cleanup
setInterval(() => {
    const now = Date.now();
    const cutoff = now - (5 * 60 * 1000);
    for (const [id, time] of taskTracker.entries()) {
        if (time < cutoff) taskTracker.delete(id);
    }
}, 60000);

function trimRecords() {
    if (mockDB.transactions.length > 5000) {
        mockDB.transactions = mockDB.transactions.slice(-2500);
    }
}

// ==========================================
// Socket Logic — مع دعم المراقب
// ==========================================
io.on('connection', async (socket) => {
    console.log(`⚡ [Network] New connection: ${socket.id}`);

    // ✅ إرسال الإحصائيات فوراً للمراقبين (وكل المتصلين)
    socket.emit('STATS_UPDATE', mockDB.stats);

    // ✅ تحديث دوري كل 3 ثوانٍ للمراقبين
    const statsInterval = setInterval(() => {
        socket.emit('STATS_UPDATE', mockDB.stats);
    }, 3000);

    const apiKey = socket.handshake.auth.token;

    // Developer Auth
    if (apiKey) {
        const client = mockDB.api_clients[apiKey];
        if (!client || client.balance_usd <= 0) {
            socket.emit('ERROR', { msg: "Authentication Failed" });
            clearInterval(statsInterval);
            return socket.disconnect();
        }
        developers[socket.id] = client;
        console.log(`👨‍💻 Developer: ${client.email}`);
    }

    // Worker Registration
    socket.on('REGISTER_WORKER', (data) => {
        let wallet = data?.wallet || "Guest_" + socket.id.substring(0, 5);
        wallet = wallet.trim();
        
        if (wallet.length < 3 || wallet.length > 64 || /[<>\"']/.test(wallet)) {
            socket.emit('ERROR', { msg: "Invalid wallet" });
            return;
        }

        workers[socket.id] = wallet;
        mockDB.stats.activeNodes = Object.keys(workers).length;
        
        if (!mockDB.users[wallet]) {
            mockDB.users[wallet] = { cowries_balance: 0 };
        }
        
        socket.emit('BALANCE_UPDATE', { balance: mockDB.users[wallet].cowries_balance });
        socket.emit('STATS_UPDATE', mockDB.stats);
        
        console.log(`📱 Worker: ${wallet}`);
    });

    // Find Node & Execute Task
    socket.on('FIND_NODE', () => {
        if (!developers[socket.id]) {
            return socket.emit('ERROR', { msg: "Auth required" });
        }

        const workerIds = Object.keys(workers);
        if (workerIds.length === 0) {
            return socket.emit('ERROR', { msg: "No nodes available" });
        }

        const targetId = workerIds[Math.floor(Math.random() * workerIds.length)];
        const workerWallet = workers[targetId];
        
        console.log(`🔄 Task assigned to: ${workerWallet}`);

        io.to(targetId).emit('EXECUTE_TASK', { 
            sender: socket.id,
            sizeBytes: 15 * 1024 * 1024,
            taskId: Date.now()
        });

        socket.emit('TASK_SENT', { targetId, wallet: workerWallet });
    });

    // Worker executes task
    socket.on('EXECUTE_TASK', (data) => {
        const { sender, sizeBytes, taskId } = data;
        const workerWallet = workers[socket.id];
        
        if (!workerWallet || workerWallet.startsWith("Guest")) return;

        setTimeout(() => {
            io.to(sender).emit('TASK_RESULT', {
                worker: workerWallet,
                result: "200_OK_RAG_PROCESSED",
                taskId
            });

            const sizeMB = sizeBytes / (1024 * 1024);
            const totalCost = sizeMB * PRICE_PER_MB_USD;
            const workerReward = totalCost * WORKER_SHARE;
            const cowriesEarned = Math.floor(workerReward * COWRIES_PER_DOLLAR);

            if (cowriesEarned > 0 && mockDB.users[workerWallet]) {
                mockDB.users[workerWallet].cowries_balance += cowriesEarned;
                mockDB.stats.totalCowries += cowriesEarned;
                
                socket.emit('BALANCE_UPDATE', { 
                    balance: mockDB.users[workerWallet].cowries_balance,
                    earned: cowriesEarned
                });
                
                io.emit('STATS_UPDATE', mockDB.stats);

                mockDB.transactions.push({
                    wallet_id: workerWallet,
                    amount: workerReward,
                    created_at: new Date()
                });
                trimRecords();

                console.log(`🪙 +${cowriesEarned} Cowries to ${workerWallet}`);
            }
        }, 2000);
    });

    // Disconnect
    socket.on('disconnect', () => {
        clearInterval(statsInterval);
        delete workers[socket.id];
        delete developers[socket.id];
        taskTracker.delete(socket.id);
        mockDB.stats.activeNodes = Object.keys(workers).length;
        io.emit('STATS_UPDATE', mockDB.stats);
        console.log(`🔌 Disconnected: ${socket.id}`);
    });
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    io.close(() => server.close(() => process.exit(0)));
});
process.on('SIGINT', () => {
    io.close(() => server.close(() => process.exit(0)));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 OpenRAG Federation Server`);
    console.log(`🌍 Port: ${PORT}`);
    console.log(`💾 In-Memory Demo Mode`);
    console.log(`🐚 Cowries: Africa's Resource Credit`);
    console.log(`========================================\n`);
});
