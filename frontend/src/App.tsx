import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { ChatLayout } from './pages/ChatLayout'
import { ProtectedRoute, PublicRoute } from './components/auth/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#252a45',
            color: '#e4e7f0',
            border: '1px solid #393e5c',
            borderRadius: '12px',
            fontSize: '13px',
            fontFamily: '"DM Sans", sans-serif',
          },
          success: { iconTheme: { primary: '#6171f6', secondary: '#fff' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  )
}
