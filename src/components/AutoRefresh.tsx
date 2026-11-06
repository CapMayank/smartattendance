'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const POLL_INTERVAL_MS = 60_000
const RECONNECT_BASE_MS = 5_000
const RECONNECT_MAX_MS = 5 * 60_000
const DEBOUNCE_MS = 4_000

export default function AutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectDelay = RECONNECT_BASE_MS
    let reconnectPending = false
    let lastRefresh = Date.now()
    let disposed = false

    const isHidden = () => document.visibilityState === 'hidden'

    const doRefresh = () => {
      lastRefresh = Date.now()
      router.refresh()
    }

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
        if (!isHidden()) doRefresh()
      }, POLL_INTERVAL_MS)
    }

    // Collapse a burst of refresh events into one trailing refresh.
    const scheduleRefresh = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(doRefresh, DEBOUNCE_MS)
    }

    const scheduleReconnect = () => {
      if (disposed) return
      clearTimeout(reconnectTimer)
      if (isHidden()) {
        // Resume when the tab becomes visible again.
        reconnectPending = true
        return
      }
      reconnectPending = false
      const delay = reconnectDelay
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS)
      reconnectTimer = setTimeout(connect, delay)
    }

    const connect = () => {
      if (disposed) return
      // Plain ws is blocked as mixed content on https pages: poll only.
      if (window.location.protocol !== 'http:') return

      let socket: WebSocket
      try {
        socket = new WebSocket(`ws://${window.location.hostname}:7789`)
      } catch {
        startPolling()
        scheduleReconnect()
        return
      }
      ws = socket

      socket.onopen = () => {
        reconnectDelay = RECONNECT_BASE_MS
        stopPolling()
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.event === 'refresh') {
            scheduleRefresh()
          }
        } catch {
          // Ignore
        }
      }

      socket.onerror = () => {
        // onclose follows; make sure polling covers the gap.
        startPolling()
      }

      socket.onclose = () => {
        if (ws === socket) ws = null
        startPolling()
        scheduleReconnect()
      }
    }

    const onVisibilityChange = () => {
      if (disposed || isHidden()) return
      if (Date.now() - lastRefresh > POLL_INTERVAL_MS) doRefresh()
      if (reconnectPending && !ws) scheduleReconnect()
    }

    startPolling()
    document.addEventListener('visibilitychange', onVisibilityChange)
    connect()

    return () => {
      disposed = true
      clearTimeout(reconnectTimer)
      clearTimeout(debounceTimer)
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibilityChange)
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
