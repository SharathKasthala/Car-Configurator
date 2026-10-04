export const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export const date = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const titleCase = (s = '') => s.charAt(0).toUpperCase() + s.slice(1)

export const ANGLES = [
  { id: 'front_3q', name: 'Front 3/4' },
  { id: 'side', name: 'Side' },
  { id: 'rear_3q', name: 'Rear 3/4' },
]
