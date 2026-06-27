const WebSocket = require('ws');

console.log("Connecting to ws://localhost:7788");
const ws = new WebSocket('ws://localhost:7788');

ws.on('open', function open() {
  console.log('Connected to server');
  ws.send(JSON.stringify({
    cmd: "reg",
    sn: "A250904118"
  }));
});

ws.on('message', function incoming(data) {
  console.log('Received:', data.toString());
  ws.close();
});

ws.on('error', console.error);
