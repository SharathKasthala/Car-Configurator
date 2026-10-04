import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  // On page load, check whether the saved token is still valid
  useEffect(() => {
    if (!localStorage.getItem('token')) { setReady(true); return }
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setReady(true))
  }, [])

  const saveSession = ({ token, user }) => {
    localStorage.setItem('token', token)
    setUser(user)
    return user
  }

  const login = async (email, password) => saveSession((await api.post('/auth/login', { email, password })).data)
  const register = async (name, email, password) => saveSession((await api.post('/auth/register', { name, email, password })).data)
  const logout = () => { localStorage.removeItem('token'); setUser(null) }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
