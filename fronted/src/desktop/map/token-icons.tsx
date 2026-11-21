export default function TokenIcon({ image, x = 0, y = 0, size = 32 }: { image: string; x?: number; y?: number; size?: number }) {
  return <svg x={x} y={y} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="#263950" stroke="#f1f6fb" strokeWidth="2" />
    <g fill="#f5e6bd">
      {image === 'hero' ? <path d="M8 10l8-4 8 4v8c0 5-8 8-8 8s-8-3-8-8zm8 0-4 4h3v7h2v-7h3z" fillRule="evenodd" />
        : image === 'beast' ? <><ellipse cx="16" cy="20" rx="6" ry="4.5" /><circle cx="8" cy="15" r="2.6" /><circle cx="13" cy="10.5" r="2.6" /><circle cx="19" cy="10.5" r="2.6" /><circle cx="24" cy="15" r="2.6" /></>
        : image === 'skull' ? <path d="M7 14a9 9 0 0 1 18 0c0 4-2 6-5 7v4h-8v-4c-3-1-5-3-5-7zm5 3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fillRule="evenodd" />
        : <path d="M16 5l9 11-9 11-9-11zm0 6-4 5 4 5 4-5z" fillRule="evenodd" />}
    </g>
  </svg>
}
