import { money } from '../lib.js'

export const TAX_RATE = 0.07
export const FREE_SHIPPING_FROM = 500
export const DELIVERY = {
  standard: { name: 'Standard shipping', desc: '5 to 7 business days' },
  express: { name: 'Express shipping', desc: '2 to 3 business days', price: 49 },
  installer: { name: 'Ship to an installer', desc: 'Delivered to a partner shop for fitting', price: 0 },
}

// items: [{ price, quantity }], promo: { percent_off } or null
export function cartTotals(items, promo, deliveryMethod = 'standard') {
  const subtotal = money(items.reduce((s, i) => s + Number(i.price) * i.quantity, 0))
  const discount = promo ? money(subtotal * promo.percent_off / 100) : 0
  const afterDiscount = subtotal - discount
  let shipping = 0
  if (items.length) {
    if (deliveryMethod === 'express') shipping = DELIVERY.express.price
    else if (deliveryMethod === 'standard') shipping = afterDiscount >= FREE_SHIPPING_FROM ? 0 : 25
  }
  const tax = money(afterDiscount * TAX_RATE)
  return { subtotal, discount, shipping, tax, total: money(afterDiscount + shipping + tax) }
}
