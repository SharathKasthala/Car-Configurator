import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../api/client.js'
import { useAuth } from './AuthContext.jsx'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [cart, setCart] = useState(null)

  const refresh = useCallback(async (delivery = 'standard') => {
    if (!user) { setCart(null); return null }
    const res = await api.get('/cart', { params: { delivery } })
    setCart(res.data)
    return res.data
  }, [user])

  useEffect(() => { refresh().catch(() => {}) }, [refresh])

  // Each action returns the updated cart from the server
  const run = async (promise) => { const res = await promise; setCart(res.data); return res.data }
  const actions = {
    addPart: (partId, quantity = 1, buildId) => run(api.post('/cart/items', { partId, quantity, buildId })),
    addBuild: (buildId) => run(api.post(`/cart/from-build/${buildId}`)),
    setQty: (itemId, quantity) => run(api.patch(`/cart/items/${itemId}`, { quantity })),
    remove: (itemId) => run(api.delete(`/cart/items/${itemId}`)),
    applyPromo: (code) => run(api.post('/cart/promo', { code })),
    removePromo: () => run(api.delete('/cart/promo')),
  }

  return (
    <CartContext.Provider value={{ cart, count: cart?.count || 0, refresh, setCart, ...actions }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
