import Image from 'next/image'

export default function Logo({ height = 36, className = '' }) {
  return (
    <Image
      src="/logo.png"
      alt="FX Unlocked"
      width={0}
      height={height}
      sizes="100vw"
      style={{ width: 'auto', height }}
      className={`object-contain ${className}`}
      priority
    />
  )
}
