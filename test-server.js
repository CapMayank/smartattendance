const net = require('net');

const server = net.createServer((socket) => {
  console.log(`\n===========================================`);
  console.log(`🟢 NEW CONNECTION FROM: ${socket.remoteAddress}`);
  console.log(`===========================================`);
  
  socket.on('data', (data) => {
    console.log(`\n📦 RAW DATA RECEIVED:`);
    console.log(data.toString());
    
    // Send a standard fake HTTP 200 OK back so the machine thinks it succeeded
    socket.write('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\n\r\nOK');
  });

  socket.on('error', (err) => {
    console.log('Socket Error:', err);
  });
});

server.listen(7788, '0.0.0.0', () => {
  console.log('📡 Listening for RAW biometric machine connections on port 7788...');
});
