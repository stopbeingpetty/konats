import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'

import RequireAuth from '@/components/RequireAuth'
import AppLayout from '@/components/AppLayout'
import LoginPage from '@/pages/LoginPage'
import CalendarPage from '@/pages/CalendarPage'
import ReservationsPage from '@/pages/ReservationsPage'
import ImportsPage from '@/pages/ImportsPage'
import SettingsPage from '@/features/settings/pages/SettingsPage'
import { RoomTypesTab } from '@/features/settings/pages/RoomTypesTab'
import { HotelInfoTab } from '@/features/settings/pages/HotelInfoTab'
import { IntegrationsTab } from '@/features/settings/pages/IntegrationsTab'
import BackupsPage from '@/pages/BackupsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/calendar" replace />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/reservations" element={<ReservationsPage />} />
              <Route path="/imports" element={<ImportsPage />} />
              <Route path="/settings" element={<SettingsPage />}>
                <Route index element={<Navigate to="/settings/room-types" replace />} />
                <Route path="room-types" element={<RoomTypesTab />} />
                <Route path="hotel-info" element={<HotelInfoTab />} />
                <Route path="integrations" element={<IntegrationsTab />} />
              </Route>
              <Route path="/backups" element={<BackupsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
