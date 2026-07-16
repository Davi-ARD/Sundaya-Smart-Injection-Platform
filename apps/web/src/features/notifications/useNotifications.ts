import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppNotification } from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'

const POLL_INTERVAL_MS = 25_000

// Polling ringan di atas REST yang sudah ada (bukan WebSocket) — cukup untuk
// notifikasi lintas role tanpa infrastruktur baru. Popup toast hanya untuk
// notifikasi yang belum pernah terlihat sejak sesi ini dibuka.
export function useNotifications() {
  const { accessToken, isAuthenticated } = useAuth()
  const toast = useToast()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const seenIds = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const data = await api.listNotifications(accessToken)
      setNotifications(data)

      if (seenIds.current === null) {
        // Baseline saat pertama kali load: jangan popup-kan notifikasi lama yang sudah ada.
        seenIds.current = new Set(data.map((item) => item.id))
      } else {
        const fresh = data.filter((item) => !seenIds.current!.has(item.id))
        for (const item of fresh) {
          toast.info(item.title)
          seenIds.current.add(item.id)
        }
      }
    } catch {
      // Polling diam-diam gagal (mis. token kedaluwarsa saat tab lama terbuka) — tidak perlu toast error berulang.
    }
  }, [accessToken, isAuthenticated, toast])

  useEffect(() => {
    seenIds.current = null
    void load()
    const interval = window.setInterval(load, POLL_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [load])

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)))
      try {
        await api.markNotificationRead(accessToken, id)
      } catch {
        void load()
      }
    },
    [accessToken, load],
  )

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
    try {
      await api.markAllNotificationsRead(accessToken)
    } catch {
      void load()
    }
  }, [accessToken, load])

  const unreadCount = notifications.filter((item) => !item.isRead).length

  return { notifications, unreadCount, markRead, markAllRead }
}
