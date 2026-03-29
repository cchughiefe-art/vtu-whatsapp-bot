const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { MongoClient } = require('mongodb');
const { useMongoDBAuthState } = require('baileys-mongodb-library');
const P = require('pino');

async function connectToWhatsApp() {
    // 1. Connect to MongoDB using your Environment Variable
    const mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    
    // 2. Setup Auth State in MongoDB
    const collection = mongoClient.db('whatsapp_bot').collection('auth');
    const { state, saveCreds } = await useMongoDBAuthState(collection);

    // 3. Initialize WhatsApp Socket
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: 'silent' })
    });

    // 4. Handle Connection Updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) console.log('Scan this QR Code in Render Logs!');
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('Bot is online and connected! 🚀');
        }
    });

    // 5. Save Credentials when updated
    sock.ev.on('creds.update', saveCreds);

    // 6. Basic Message Listener
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            if (text === '.ping') {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Pong! 🏓 Bot is active.' });
            }
        }
    });
}

connectToWhatsApp();

