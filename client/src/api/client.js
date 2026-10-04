import axios from 'axios'

// All requests go through /api (proxied to the Express server in development)
const api = axios.create({ baseURL: '/api' })

// Send the login token with every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Pulls a readable message out of an API error
export const errorText = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.error || fallback

export default api
