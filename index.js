const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Keep-alive server for Render
app.get('/', (req, res) => {
  res.send('Bot is online! 🚀');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const { MongoClient } = require('mongodb');
const P = require('pino');

async function connectToWhatsApp() {
    // 1. Connect to MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log("Connected to MongoDB! 🗄️");

    // 2. Setup Auth State
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    // 3. Initialize Socket
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // Using pairing code instead
        logger: P({ level: 'silent' })
    });

    // 4. Pairing Code Logic
    if (!sock.authState.creds.registered) {
        const phoneNumber = "2348120719723"; 
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n\n==============================`);
                console.log(`YOUR PAIRING CODE: ${code}`);
                console.log(`==============================\n\n`);
            } catch (error) {
                console.log("Error requesting pairing code:", error);
            }
        }, 3000);
    }

    // 5. Connection Updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('WhatsApp Bot is officially online! ✅');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 6. Simple Ping Command
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            if (text === '.ping') {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Pong! 🏓' });
            }
        }
    });
}

connectToWhatsApp();

