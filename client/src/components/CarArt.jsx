// Simple side-view drawing used where no photo or AI preview exists yet
export default function CarArt({ color = '#4A4F55', rim = '#8d9298', spoiler = false, kit = false }) {
  return (
    <svg viewBox="0 0 800 300" style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden="true">
      <ellipse cx="400" cy="270" rx="360" ry="12" fill="#000" opacity="0.5" />
      <path d="M58 222 L58 186 Q62 162 112 152 L232 138 Q292 92 362 84 L498 84 Q562 88 612 132 L702 146 Q742 154 746 184 L746 222 Z" fill={color} />
      <path d="M118 162 L238 148 Q298 104 362 96 L496 96 Q548 100 588 130 L250 158 Z" fill="#fff" opacity="0.1" />
      <path d="M252 140 Q300 100 366 94 L470 94 L470 140 Z" fill="#1c252d" />
      <path d="M484 94 L500 94 Q546 98 584 138 L484 140 Z" fill="#1c252d" />
      <path d="M60 178 L96 172 L98 182 L60 186 Z" fill="#f3f1e7" />
      <path d="M732 160 L746 166 L746 178 L730 176 Z" fill="#c4302b" />
      {kit && <path d="M52 220 L168 220 L158 231 L56 231 Z" fill="#0b0b0c" />}
      {spoiler && <path d="M658 112 L740 105 L742 116 L660 121 Z M690 142 L694 116 L701 116 L699 144 Z" fill="#0b0b0c" />}
      {[182, 622].map((x) => (
        <g key={x}>
          <circle cx={x} cy="222" r="48" fill="#0b0b0c" />
          <circle cx={x} cy="222" r="32" fill={rim} />
          <circle cx={x} cy="222" r="7" fill="#444850" />
        </g>
      ))}
    </svg>
  )
}

// Picks drawing details from a saved build
export function buildArtProps(build) {
  const wheel = build.parts?.find((p) => p.category === 'Wheels')
  const finish = wheel?.specs?.finish || ''
  return {
    color: build.hex_color || '#4A4F55',
    rim: /black/i.test(finish) ? '#2b2d31' : /bronze/i.test(finish) ? '#a0784a' : wheel ? '#cfd2d6' : '#8d9298',
    spoiler: build.parts?.some((p) => p.category === 'Spoilers'),
    kit: build.parts?.some((p) => p.category === 'Body kits'),
  }
}
