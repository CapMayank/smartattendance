'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      // Connect to the Web UI WS Server
      ws = new WebSocket('ws://localhost:7789');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'refresh') {
            router.refresh();
          }
        } catch (e) {
          // Ignore
        }
      };

      ws.onclose = () => {
        // Try to reconnect in 5 seconds if connection is lost
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // Prevent reconnect on unmount
        ws.close();
      }
    };
  }, [router])

  return null
}
