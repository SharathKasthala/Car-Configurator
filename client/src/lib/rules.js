// Part selection rules used by the configurator.
// The server checks the same rules again before saving or checkout.

export const SINGLE_CHOICE = ['Wheels', 'Exhaust']

// Why a part can't be picked right now, or null if it can
export function blockReason(part, selected, parts, rules) {
  for (const r of rules) {
    if (r.rule_type === 'requires' && r.part_id === part.id && !selected.has(r.related_part_id)) {
      const needed = parts.find((p) => p.id === r.related_part_id)
      return needed ? `Needs ${needed.name}` : 'Needs another part first'
    }
  }
  return null
}

// Returns a new selection after toggling one part, applying all rules
export function togglePart(partId, selected, parts, rules) {
  const next = new Set(selected)
  const part = parts.find((p) => p.id === partId)

  if (next.has(partId)) {
    next.delete(partId)
  } else {
    // Only one wheel set / exhaust at a time
    if (SINGLE_CHOICE.includes(part.category)) {
      parts.filter((p) => p.category === part.category).forEach((p) => next.delete(p.id))
    }
    // Picking a part removes anything it conflicts with
    rules.filter((r) => r.rule_type === 'conflicts').forEach((r) => {
      if (r.part_id === partId) next.delete(r.related_part_id)
      if (r.related_part_id === partId) next.delete(r.part_id)
    })
    next.add(partId)
  }

  // Drop any part whose required part is no longer selected
  let changed = true
  while (changed) {
    changed = false
    for (const r of rules) {
      if (r.rule_type === 'requires' && next.has(r.part_id) && !next.has(r.related_part_id)) {
        next.delete(r.part_id)
        changed = true
      }
    }
  }
  return next
}
