process.env.TZ = "Asia/Kolkata";

const WebSocket = require('ws');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { redactForLog, summarizeMessage, clip, clipJson } = require('./ws-lib/redact');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS entry run by pm2
const { collectPhoto, processPhotosAfterAck } = require('./ws-lib/photo-ingest');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS entry run by pm2
const { ingestPunchRecord } = require('./ws-lib/unmatched-ingest');

function getISTTimeStr() {
  const d = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffset);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${istDate.getUTCFullYear()}-${pad(istDate.getUTCMonth()+1)}-${pad(istDate.getUTCDate())} ${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())}:${pad(istDate.getUTCSeconds())}`;
}

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
    let data;
    let parsed = true;
    try {
      data = JSON.parse(rawData);
      if (!data || typeof data !== 'object') data = {};
    } catch (e) {
      data = {};
      parsed = false;
    }
    // Logging must never be able to change `data` or stop processing.
    try {
      if (parsed) console.log(`\n📦 [Biometric WS] RECEIVED: ${summarizeMessage(data)}`);
      else console.log(`\n📦 [Biometric WS] unparsable message (${rawData.length} chars)`);
    } catch (e) {
      console.log('message received (summary unavailable)');
    }

    // Update Device lastPing or auto-register if it doesn't exist
    try {
      const ipRaw = req.socket.remoteAddress || '';
      const ipAddress = ipRaw.replace(/^.*:/, '');
      const serialNumber = data.sn ? String(data.sn).trim() : null;
      
      let existingDevice = null;
      if (serialNumber) {
        existingDevice = await prisma.device.findFirst({
          where: { serialNumber: serialNumber }
        });
      }
      
      if (!existingDevice && ipAddress) {
        existingDevice = await prisma.device.findFirst({
          where: { ipAddress: { contains: ipAddress } }
        });
      }

      if (existingDevice) {
        await prisma.device.update({
          where: { id: existingDevice.id },
          data: { 
            lastPing: new Date(), 
            status: 'ONLINE',
            ...(serialNumber && { serialNumber }),
            ...(ipAddress && { ipAddress })
          }
        });
      } else if (serialNumber || ipAddress) {
        // Auto-register the device so it shows up in the dashboard
        const deviceName = serialNumber ? `Device ${serialNumber}` : `Auto-Registered (${ipAddress})`;
        await prisma.device.create({
          data: {
            name: deviceName,
            ipAddress: ipAddress,
            serialNumber: serialNumber,
            status: 'ONLINE',
            lastPing: new Date()
          }
        });
        console.log(`✅ [Biometric WS] Auto-registered new device SN: ${clip(serialNumber || 'N/A')}, IP: ${clip(ipAddress)}`);
      }
      broadcastToUI();
    } catch (e) {
      console.log(`⚠️ [Biometric WS] Error updating device ping:`, clip(e && e.message));
    }

    try {
      if (Object.keys(data).length === 0) return;

      // Handle responses from the device to our commands (like settime)
      if (data.ret && !data.cmd) {
        console.log(`ℹ️ [Biometric WS] Received response for ${clip(data.ret)}: result=${clip(data.result)}`);
        return;
      }

      // Handle Registration
      if (data.cmd === 'reg') {
        console.log(`✅ [Biometric WS] Handling Registration for SN: ${clip(data.sn)}`);
        // Standard AiFace acknowledgment
        const ack = {
          ret: 'reg',
          result: true,
          cloudtime: getISTTimeStr()
        };
        ws.send(JSON.stringify(ack));
        console.log(`📤 [Biometric WS] Sent ACK:`, clipJson(ack));

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
        let records = [];
        if (data.record) {
          records = Array.isArray(data.record) ? data.record : [data.record];
        } else if (Array.isArray(data)) {
          records = data;
        } else {
          // If the payload itself is the record
          if (data.enrollid || data.pin || data.userid || data.user_id) {
            records = [data];
          }
        }
        
        let savedCount = 0;
        // Photos are handled only after the ACK below, so they can never delay or alter it.
        const photoItems = [];

        if (records.length === 0 || data.count === 0) {
            console.log(`ℹ️ [Biometric WS] Empty sendlog received.`);
        }

        for (const record of records) {
          const result = await ingestPunchRecord(prisma, record, { photoItems, collectPhoto });
          if (result.status === 'SKIPPED') {
            console.log(`⚠️ [Biometric WS] Incomplete record found, skipping:`, redactForLog(record));
            continue;
          }
          if (result.status === 'UNMATCHED_UNKNOWN') {
            console.log(`⚠️ [Biometric WS] Unknown machine ID: ${clip(record.enrollid || record.pin || record.user_id || record.userid)}. Diverted to UnmatchedPunch.`);
            savedCount++;
            broadcastToUI();
            continue;
          }
          if (result.status === 'UNMATCHED_NOT_EMPLOYED') {
            console.log(`⚠️ [Biometric WS] Staff not employed on date for machine ID: ${clip(record.enrollid || record.pin || record.user_id || record.userid)}. Diverted to UnmatchedPunch.`);
            savedCount++;
            broadcastToUI();
            continue;
          }
          if (result.status === 'SAVED') {
            console.log(`💾 [Biometric WS] Saved punch for ${result.staff.name} (${clip(result.staff.machineId)}) at ${result.punchTime.toISOString()} (${result.type})`);
            savedCount++;
            broadcastToUI();
          }
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
          console.log(`📤 [Biometric WS] Sent ACK:`, clipJson(ack));
        } else if (data.cmd) {
          // generic ack just in case
          const ack = { ret: data.cmd, result: true };
          ws.send(JSON.stringify(ack));
          console.log(`📤 [Biometric WS] Sent generic ACK:`, clipJson(ack));
        }

        // After the ACK: sequential, in order; never throws.
        try {
          await processPhotosAfterAck(prisma, photoItems);
        } catch (e) {
          console.log(`[photo] ingest failed: ${clip(e && e.message)}`);
        }

      }
      else {
        // Unknown command
        console.log(`⚠️ [Biometric WS] Unknown command received`);
        // Try to acknowledge it anyway to keep device happy
        if (data.cmd) {
           const ack = { ret: data.cmd, result: true };
           ws.send(JSON.stringify(ack));
           console.log(`📤 [Biometric WS] Sent generic ACK:`, clipJson(ack));
        }
      }

    } catch (err) {
      console.log(`⚠️ [Biometric WS] Error parsing or processing message: ${clip(err && err.message)}`);
    }
  });

  ws.on('close', () => {
    console.log(`🔴 [Biometric WS] MACHINE DISCONNECTED`);
    broadcastToUI();
  });

  ws.on('error', (err) => {
    console.log(`❌ [Biometric WS] SOCKET ERROR: ${clip(err && err.message)}`);
  });
});
