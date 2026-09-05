import React from 'react'

// One stroked icon set, drawn on a 24-grid. Icons are decorative — every
// control that uses one also carries a label or an aria-label.
const PATHS = {
  recipes: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5v-13ZM4 17h15M9 7h6',
  plan: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12ZM4 10h16M8 3v4M16 3v4',
  shop: 'M4 12.5 9 18l11-12',
  pantry: 'M12 4v3M7.5 7h9l2.5 8.5A4 4 0 0 1 15.2 21H8.8a4 4 0 0 1-3.8-5.5L7.5 7ZM5.6 15.5h12.8',
  gear:
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M19.4 13.5a7.6 7.6 0 0 0 0-3l1.7-1.3-1.9-3.3-2 .8a7.6 7.6 0 0 0-2.6-1.5L14.3 3H9.7l-.3 2.2a7.6 7.6 0 0 0-2.6 1.5l-2-.8L2.9 9.2l1.7 1.3a7.6 7.6 0 0 0 0 3l-1.7 1.3 1.9 3.3 2-.8a7.6 7.6 0 0 0 2.6 1.5l.3 2.2h4.6l.3-2.2a7.6 7.6 0 0 0 2.6-1.5l2 .8 1.9-3.3-1.7-1.3Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  sort: 'M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l-3 3M17 20l3-3',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5 10 17.5 19 7',
}

export default function Icon({ name, size = 18, className = '' }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {d.split(' M').map((seg, i) => (
        <path key={i} d={i ? `M${seg}` : seg} />
      ))}
    </svg>
  )
}
