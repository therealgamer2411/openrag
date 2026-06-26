require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');

// ==========================================
// 1. إعدادات السيرفر الأساسية
// ==========================================
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

// ==========================================
// 2. قاعدة البيانات المحلية (In-Memory Mock DB للـ Demo)
// ==========================================
const mockDB = {
    api_clients: {
        "Africa_Grid_Secret_Key_2026_xyz": { 
            id: "dev_1", 
            email: "admin@openrag.africa", 
            balance_usd: 100.00 
        }
    },
    users: {}, 
    transactions: [],
    withdrawals: []
};

// ==========================================
// 3. إعدادات الشبكة و METERED (P2P Tunneling)
// ==========================================
const METERED_API_KEY = "639e86e8bf095dd6923a9c4806f108943bef";

let cachedIceServers = null;
let lastIceFetchTime = 0;
const ICE_CACHE_DURATION = 1000 * 60 * 60 * 6; // تحديث كل 6 ساعات

async function getIceServers() {
    const NOW = Date.now();
    if (cachedIceServers && (NOW - lastIceFetchTime < ICE_CACHE_DURATION)) {
        return cachedIceServers;
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
        console.error("[!] Metered API Error:", e);
        return cachedIceServers || []; 
    }
}

// ==========================================
// 4. المحرك الاقتصادي (The Economy Engine - Cowries)
// ==========================================
const PRICE_PER_MB_USD = 0.004; 
const WORKER_SHARE = 0.25; 
const COWRIES_PER_DOLLAR = 1000; 

let workers = {}; 
let developers = {}; 

// ==========================================
// 5. إدارة اتصالات الشبكة (Socket Logic)
// ==========================================
io.on('connection', async (socket) => {
    console.log(`⚡ [Network] New connection detected: ${socket.id}`);

    // 🔥 الحل الجذري: تسجيل أوامر الاستماع (Listeners) فوراً قبل أي عملية (await)
    
    // ------------------------------------------
    // تسجيل العقدة / العامل (Worker Registration)
    // ------------------------------------------
    socket.on('REGISTER_WORKER', (data) => {
        const wallet = data?.wallet || "Guest_" + socket.id.substr(0, 5);
        workers[socket.id] = wallet;
        console.log(`📱 [Grid] Worker Node Ready: ${socket.id} | Wallet: ${wallet}`);
        
        if (!wallet.startsWith("Guest")) {
            if (!mockDB.users[wallet]) {
                mockDB.users[wallet] = { cowries_balance: 0 };
            }
            socket.emit('BALANCE_UPDATE', { balance: mockDB.users[wallet].cowries_balance });
        }
    });

    // ------------------------------------------
    // توجيه الأحمال (FIND NODE)
    // ------------------------------------------
    socket.on('FIND_NODE', () => {
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

    // تمرير إشارات WebRTC بين العقد لفتح نفق P2P
    socket.on('SIGNAL', (data) => {
        io.to(data.target).emit('SIGNAL', { sender: socket.id, signal: data.signal });
    });

    // ------------------------------------------
    // المحاسبة وإصدار عملة الكاوري (Task Completed)
    // ------------------------------------------
    socket.on('TASK_COMPLETED', (data) => {
        const { sizeBytes } = data;
        const workerWallet = workers[socket.id]; 
        
        if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > (50 * 1024 * 1024)) {
            console.log(`🚨 [Security] Suspicious Task Payload from ${socket.id}`);
            return;
        }

        if (!workerWallet || workerWallet.startsWith("Guest")) return;

        const sizeMB = sizeBytes / (1024 * 1024);
        const totalCost = sizeMB * PRICE_PER_MB_USD; 
        const workerReward = totalCost * WORKER_SHARE;
        
        const cowriesEarned = Math.floor(workerReward * COWRIES_PER_DOLLAR);

        if (cowriesEarned <= 0) return;

        if (mockDB.users[workerWallet]) {
            mockDB.users[workerWallet].cowries_balance += cowriesEarned;
            
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

            console.log(`🪙  [Economy] Added ${cowriesEarned} Cowries to ${workerWallet}. Total: ${mockDB.users[workerWallet].cowries_balance}`);
        }
    });

    // ------------------------------------------
    // طلب السحب (Redeem Cowries)
    // ------------------------------------------
    socket.on('REDEEM_REQUEST', (data) => {
        const { phoneNumber, amountEGP } = data;
        const wallet = workers[socket.id];
        if (!wallet || wallet.startsWith("Guest")) return socket.emit('REDEEM_ERROR', { msg: "Login first" });

        const COWRIES_REQUIRED = amountEGP * 20; 
        
        const user = mockDB.users[wallet];
        if (!user || user.cowries_balance < COWRIES_REQUIRED) {
            return socket.emit('REDEEM_ERROR', { msg: "Low Cowries Balance" });
        }

        user.cowries_balance -= COWRIES_REQUIRED;
        mockDB.withdrawals.push({
            wallet_id: wallet, 
            phone_number: phoneNumber, 
            amount_egp: amountEGP, 
            cowries_deducted: COWRIES_REQUIRED,
            created_at: new Date()
        });

        console.log(`💸 [Economy] Redeem processed for ${wallet}. Deducted: ${COWRIES_REQUIRED} Cowries.`);
        socket.emit('REDEEM_SUCCESS', { newBalance: user.cowries_balance, msg: "Redeem Request Sent!" });
    });

    // تنظيف العقدة عند قطع الاتصال
    socket.on('disconnect', () => {
        console.log(`🔌 [Grid] Node Disconnected: ${socket.id}`);
        delete workers[socket.id];
        delete developers[socket.id];
    });


    // ------------------------------------------
    // ⏳ بعد تأمين الـ Listeners، نقوم بجلب البيانات والتحقق من الهوية
    // ------------------------------------------
    const iceServers = await getIceServers();
    const apiKey = socket.handshake.auth.token;
    
    if (apiKey) {
        const client = mockDB.api_clients[apiKey];
        
        if (!client || client.balance_usd <= 0) {
            console.log(`⛔ Auth Failed or Zero Balance for: ${apiKey}`);
            socket.emit('ERROR', { msg: "Authentication Failed or Insufficient Balance" });
            return socket.disconnect(); 
        }
        
        developers[socket.id] = client;
        console.log(`👨‍💻 [Grid] Developer Ready: ${client.email}`);
    }

    // إرسال الإعدادات بعد نجاح التحقق (يُفعّل الـ Promise في كود العميل)
    socket.emit('CONFIG', { iceServers });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 OpenRAG Federation Server (In-Memory DB)`);
    console.log(`🌍 Running on Port: ${PORT}`);
    console.log(`========================================\n`);
});