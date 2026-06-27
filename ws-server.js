const WebSocket = require('ws');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const wss = new WebSocket.Server({ port: 7788, host: '0.0.0.0' });
const uiWss = new WebSocket.Server({ port: 7789, host: '0.0.0.0' });

console.log('📡 [Biometric WS] Server listening on port 7788...');
console.log('🖥️ [Web UI WS] Server listening on port 7789...');

function broadcastToUI() {
  uiWss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event: 'refresh' }));
    }
  });
}

wss.on('connection', function connection(ws, req) {
  const ip = req.socket.remoteAddress;
  console.log(`\n===========================================`);
  console.log(`🟢 [Biometric WS] MACHINE CONNECTED: ${ip}`);
  console.log(`===========================================\n`);
  
  // Trigger a refresh on UI when a machine connects
  broadcastToUI();

  ws.on('message', async function incoming(message) {
    const rawData = message.toString();
    console.log(`\n📦 [Biometric WS] RECEIVED DATA:`);
    console.log(rawData);

    // Update Device lastPing or auto-register if it doesn't exist
    try {
      const ipRaw = req.socket.remoteAddress || '';
      const ipAddress = ipRaw.replace(/^.*:/, '');
      
      const existingDevice = await prisma.device.findFirst({
        where: { ipAddress: { contains: ipAddress } }
      });

      if (existingDevice) {
        await prisma.device.update({
          where: { id: existingDevice.id },
          data: { lastPing: new Date(), status: 'ONLINE' }
        });
      } else if (ipAddress) {
        // Auto-register the device so it shows up in the dashboard
        await prisma.device.create({
          data: {
            name: `Auto-Registered (${ipAddress})`,
            ipAddress: ipAddress,
            status: 'ONLINE',
            lastPing: new Date()
          }
        });
        console.log(`✅ [Biometric WS] Auto-registered new device with IP: ${ipAddress}`);
      }
      broadcastToUI();
    } catch (e) {
      console.log(`⚠️ [Biometric WS] Error updating device ping:`, e.message);
    }

    try {
      // Try to parse the message as JSON
      const data = JSON.parse(rawData);

      // Handle responses from the device to our commands (like settime)
      if (data.ret && !data.cmd) {
        console.log(`ℹ️ [Biometric WS] Received response for ${data.ret}: result=${data.result}`);
        return;
      }

      // Handle Registration
      if (data.cmd === 'reg') {
        console.log(`✅ [Biometric WS] Handling Registration for SN: ${data.sn}`);
        // Standard AiFace acknowledgment
        const ack = {
          ret: 'reg',
          result: true,
          cloudtime: new Date().toISOString().replace('T', ' ').substring(0, 19)
        };
        ws.send(JSON.stringify(ack));
        console.log(`📤 [Biometric WS] Sent ACK:`, JSON.stringify(ack));

        // Explicitly send a command to set the machine's time
        const now = new Date();
        const setTimeCommand = {
          cmd: "settime",
          cloudtime: ack.cloudtime,
          nowtime: now.getTime()
        };
        ws.send(JSON.stringify(setTimeCommand));
        console.log(`📤 [Biometric WS] Sent settime command:`, JSON.stringify(setTimeCommand));
      }
      // Handle Live Punches / Sendlog
      else if (data.cmd === 'sendlog' || data.cmd === 'punch') {
        console.log(`✅ [Biometric WS] Handling Logs/Punches...`);
        
        // Sometimes records are in 'record', sometimes top level array
        const records = data.record || (Array.isArray(data) ? data : [data]);
        
        let savedCount = 0;

        if (records.length === 0 || data.count === 0) {
            console.log(`ℹ️ [Biometric WS] Empty sendlog received.`);
        }

        for (const record of records) {
          // Extract necessary fields, with fallbacks for different machine formats
          const machineUserId = String(record.enrollid || record.pin || record.user_id || record.userid || '');
          const timestampStr = record.verifytime || record.time || record.timestamp || record.datetime;
          
          if (!machineUserId || !timestampStr) {
             console.log(`⚠️ [Biometric WS] Incomplete record found, skipping:`, record);
             continue;
          }

          // Use the server's current time because machine time can be incorrect
          const serverTime = new Date();

          // Attempt to find staff member by machineId
          const staff = await prisma.staff.findUnique({
            where: { machineId: machineUserId }
          });

          if (!staff) {
            console.log(`⚠️ [Biometric WS] Staff not found for machine ID: ${machineUserId}. Log not saved.`);
            continue;
          }

          // Create Attendance Log
          // In some devices, logtype / status denotes IN or OUT. Defaulting to IN if unknown.
          const type = (record.logtype === 1 || record.status === 1) ? 'OUT' : 'IN';

          await prisma.attendanceLog.create({
            data: {
              staffId: staff.id,
              timestamp: serverTime,
              type: type,
            }
          });
          
          console.log(`💾 [Biometric WS] Saved punch for ${staff.name} (${machineUserId}) at ${serverTime.toISOString()} (Machine reported: ${timestampStr}) (${type})`);
          savedCount++;
          broadcastToUI();
        }

        // Send ACK back for logs so the machine clears them from buffer
        if (data.cmd === 'sendlog') {
          const ack = {
            ret: 'sendlog',
            result: true,
            count: data.count || savedCount,
            logindex: data.logindex || 0
          };
          ws.send(JSON.stringify(ack));
          console.log(`📤 [Biometric WS] Sent ACK:`, JSON.stringify(ack));
        } else if (data.cmd) {
          // generic ack just in case
          const ack = { ret: data.cmd, result: true };
          ws.send(JSON.stringify(ack));
          console.log(`📤 [Biometric WS] Sent generic ACK:`, JSON.stringify(ack));
        }

      }
      else {
        // Unknown command
        console.log(`⚠️ [Biometric WS] Unknown command received: ${data.cmd}`);
        // Try to acknowledge it anyway to keep device happy
        if (data.cmd) {
           const ack = { ret: data.cmd, result: true };
           ws.send(JSON.stringify(ack));
           console.log(`📤 [Biometric WS] Sent generic ACK:`, JSON.stringify(ack));
        }
      }

    } catch (err) {
      console.log(`⚠️ [Biometric WS] Error parsing or processing message: ${err.message}`);
    }
  });

  ws.on('close', () => {
    console.log(`🔴 [Biometric WS] MACHINE DISCONNECTED`);
    broadcastToUI();
  });

  ws.on('error', (err) => {
    console.log(`❌ [Biometric WS] SOCKET ERROR: ${err.message}`);
  });
});
