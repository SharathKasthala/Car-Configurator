import { Navigate, useLocation } from 'react-router-dom'
import { Spinner, Alert } from 'react-bootstrap'
import { useAuth } from '../context/AuthContext.jsx'

const Loading = () => <div className="text-center py-5"><Spinner animation="border" role="status" /></div>

export function RequireAuth({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

export function RequireAdmin({ children }) {
  const { user, ready, isAdmin } = useAuth()
  const location = useLocation()
  if (!ready) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!isAdmin) return <Alert variant="secondary">This page is for admins only.</Alert>
  return children
}
