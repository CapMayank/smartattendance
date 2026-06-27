const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 7788 });

console.log('📡 WebSocket Server listening on port 7788 for biometric machine connections...');

wss.on('connection', function connection(ws, req) {
  const ip = req.socket.remoteAddress;
  console.log(`\n===========================================`);
  console.log(`🟢 MACHINE CONNECTED VIA WEBSOCKET: ${ip}`);
  console.log(`URL: ${req.url}`);
  console.log(`===========================================\n`);

  ws.on('message', function incoming(message) {
    console.log(`📦 MACHINE SENT DATA:`);
    console.log(message.toString());
    
    // Some machines require an ack back, let's just log for now
  });

  ws.on('close', () => {
    console.log(`🔴 MACHINE DISCONNECTED`);
  });

  ws.on('error', (err) => {
    console.log(`❌ SOCKET ERROR: ${err}`);
  });
});
