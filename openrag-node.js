const io = require('socket.io-client');
const SimplePeer = require('simple-peer');
const wrtc = require('@roamhq/wrtc');
const cheerio = require('cheerio');

class OpenRAG {
    constructor(serverUrl, apiKey, walletId) {
        this.serverUrl = serverUrl;
        this.apiKey = apiKey;
        this.walletId = walletId; // اسم المحفظة/المؤسسة التي ستستقبل الكاوري
        this.socket = null;
        this.iceServers = [];
    }

    connect() {
        return new Promise((resolve, reject) => {
            console.log(`⏳ Connecting to OpenRAG Federation Layer...`);
            this.socket = io(this.serverUrl, { 
                auth: { token: this.apiKey },
                reconnection: true
            });
            
            this.socket.on('connect', () => {
                console.log(`✅ Connected successfully! Node ID: ${this.socket.id}`);
                // تسجيل العقدة في الشبكة لتبدأ في استقبال المهام وكسب الكاوري
                this.socket.emit('REGISTER_WORKER', { wallet: this.walletId });
            });

            this.socket.on('CONFIG', (data) => {
                this.iceServers = data.iceServers;
                console.log(`🔒 Zero-Trust P2P Configured.`);
                resolve();
            });

            this.socket.on('BALANCE_UPDATE', (data) => {
                console.log(`\n========================================`);
                console.log(`🪙  [Economy] Wallet: ${this.walletId}`);
                console.log(`💼  Total Balance: ${data.balance} Cowries`);
                if (data.earned) console.log(`📈  Just Earned: +${data.earned} Cowries`);
                console.log(`========================================\n`);
            });
            
            this.socket.on('ERROR', (err) => {
                console.error(`❌ [Error] ${err.msg}`);
                reject(new Error(err.msg));
            });
        });
    }

    // دالة محاكاة معالجة مهمة (لغرض الـ Demo وإثبات ربح الكاوري)
    async simulateAITask() {
        if (!this.socket) await this.connect();

        console.log(`🔍 Requesting compute workload from Grid...`);
        this.socket.emit('FIND_NODE');

        this.socket.once('NODE_FOUND', ({ targetId }) => {
            console.log(`🔄 [Grid] Matched with Node: ${targetId}. Establishing secure tunnel...`);
            
            // محاكاة استغراق وقت في المعالجة ونقل البيانات (3 ثوانٍ)
            setTimeout(() => {
                // محاكاة معالجة 15 ميجابايت من بيانات الـ RAG
                const processedBytes = 15 * 1024 * 1024; 
                console.log(`✅ [Compute] Task completed! Processed 15 MB of RAG data.`);
                console.log(`📤 Sending Proof-of-Work to Federation Server...`);
                
                // إرسال إثبات العمل للسيرفر ليقوم بصرف الكاوري
                this.socket.emit('TASK_COMPLETED', { sizeBytes: processedBytes });
            }, 3000);
        });
    }
}

// ==========================================
// 🚀 تشغيل الـ Demo
// ==========================================
// 1. تحديد الرابط المحلي، المفتاح السري، واسم محفظة العقدة
const LOCAL_SERVER = "http://localhost:3000";
const API_KEY = "Africa_Grid_Secret_Key_2026_xyz";
const WALLET_ID = "Cairo_University_GPU_01"; // اسم المؤسسة المشاركة

const workerNode = new OpenRAG(LOCAL_SERVER, API_KEY, WALLET_ID);

// 2. الاتصال ثم تنفيذ مهمة ذكاء اصطناعي بعد ثانيتين
workerNode.connect().then(() => {
    setTimeout(() => {
        workerNode.simulateAITask();
    }, 2000);
});