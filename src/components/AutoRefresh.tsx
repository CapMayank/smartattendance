'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const POLL_INTERVAL_MS = 60_000
const RECONNECT_INTERVAL_MS = 5_000

export default function AutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined
    let disposed = false

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = undefined
      }
    }

    // Fallback while the socket is not open: refresh every 60s, only when the tab is visible.
    const startPolling = () => {
      if (pollTimer || disposed) return
      pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') router.refresh()
      }, POLL_INTERVAL_MS)
    }

    const connect = () => {
      if (disposed) return
      // Plain ws is blocked as mixed content on https pages: poll only.
      if (window.location.protocol !== 'http:') {
        startPolling()
        return
      }

      let socket: WebSocket
      try {
        socket = new WebSocket(`ws://${window.location.hostname}:7789`)
      } catch {
        startPolling()
        reconnectTimer = setTimeout(connect, RECONNECT_INTERVAL_MS)
        return
      }
      ws = socket

      socket.onopen = () => stopPolling()

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.event === 'refresh') {
            router.refresh()
          }
        } catch {
          // Ignore
        }
      }

      socket.onerror = () => {
        // Handled by onclose; swallow to avoid unhandled noise.
      }

      socket.onclose = () => {
        startPolling()
        // Try to reconnect in 5 seconds if connection is lost
        reconnectTimer = setTimeout(connect, RECONNECT_INTERVAL_MS)
      }
    }

    connect()

    return () => {
      disposed = true
      clearTimeout(reconnectTimer)
      stopPolling()
      if (ws) {
        ws.onopen = null
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null // Prevent reconnect on unmount
        ws.close()
      }
    }
  }, [router])

  return null
}
