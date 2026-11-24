import { useId, useRef, useState } from 'react'
import { MAP_AVATAR_MAX_LENGTH } from '@dhgc/shared/desktop'
import { clamp } from './map-geometry'

type Crop = { zoom: number; x: number; y: number }

export default function AvatarUpload({ onConfirm }: { onConfirm: (image: string) => boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const request = useRef(0)
  const drag = useRef<{ pointer: number; x: number; y: number; crop: Crop } | null>(null)
  const clipId = useId()
  const [source, setSource] = useState<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 })
  const [shape, setShape] = useState<'square' | 'circle'>('circle')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [over, setOver] = useState(false)
  const width = source ? source.naturalWidth / Math.min(source.naturalWidth, source.naturalHeight) * 100 : 100
  const height = source ? source.naturalHeight / Math.min(source.naturalWidth, source.naturalHeight) * 100 : 100

  function constrain(next: Crop): Crop {
    const maxX = (width * next.zoom - 100) / 2
    const maxY = (height * next.zoom - 100) / 2
    return { ...next, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) }
  }

  async function load(file?: File) {
    if (!file) return
    const current = ++request.current
    setError('')
    setLoading(false)
    if (!file.type.startsWith('image/')) { setError('请选择图片文件'); return }
    if (file.size > 20 * 1024 * 1024) { setError('图片不能超过 20 MB'); return }
    setLoading(true)
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      // Keep a local raster source after revoking the file URL, including for SVG uploads.
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法读取图片')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const raster = new Image()
      raster.src = canvas.toDataURL('image/png')
      await raster.decode()
      if (current !== request.current) return
      setSource(raster)
      setCrop({ zoom: 1, x: 0, y: 0 })
    } catch {
      if (current === request.current) setError('无法读取图片，请换一张图片')
    } finally {
      URL.revokeObjectURL(url)
      if (current === request.current) setLoading(false)
    }
  }

  function cancel() {
    request.current++
    setSource(null)
    setLoading(false)
    setError('')
    drag.current = null
  }

  function confirm() {
    if (!source) return
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法裁剪图片')
      const side = Math.min(source.naturalWidth, source.naturalHeight) / crop.zoom
      for (const pixels of [192, 128, 96, 64]) {
        canvas.width = canvas.height = pixels
        context.drawImage(source, (source.naturalWidth - side) / 2 - crop.x * side / 100,
          (source.naturalHeight - side) / 2 - crop.y * side / 100, side, side, 0, 0, pixels, pixels)
        for (const quality of [0.85, 0.65, 0.45]) {
          const image = `avatar-${shape}:${canvas.toDataURL('image/webp', quality)}`
          if (image.length <= MAP_AVATAR_MAX_LENGTH) {
            if (onConfirm(image)) cancel()
            return
          }
        }
      }
      setError('图片细节过多，请放大裁剪后重试')
    } catch { setError('无法裁剪图片，请换一张图片') }
  }

  return (
    <div className="room-map-avatar">
      <input ref={input} type="file" accept="image/*" hidden aria-label="上传自选头像" onChange={event => {
        void load(event.target.files?.[0])
        event.target.value = ''
      }} />
      <div className={`room-map-avatar-upload ${over ? 'is-over' : ''}`}
        onDragOver={event => { event.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={event => { event.preventDefault(); setOver(false); void load(event.dataTransfer.files[0]) }}>
        {source ? <>
          <svg viewBox="0 0 100 100" className="room-map-avatar-crop" aria-label="拖动头像调整裁剪，滚轮缩放"
            onWheel={event => { event.stopPropagation(); setCrop(current => constrain({ ...current, zoom: clamp(current.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), 1, 5) })) }}
            onPointerDown={event => {
              if (event.button !== 0) return
              event.currentTarget.setPointerCapture(event.pointerId)
              drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, crop }
            }}
            onPointerMove={event => {
              const active = drag.current
              if (!active || active.pointer !== event.pointerId) return
              const bounds = event.currentTarget.getBoundingClientRect()
              const unit = 100 / Math.min(bounds.width, bounds.height)
              setCrop(constrain({ ...active.crop, x: active.crop.x + (event.clientX - active.x) * unit, y: active.crop.y + (event.clientY - active.y) * unit }))
            }}
            onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}>
            <defs><clipPath id={clipId}>{shape === 'circle' ? <circle cx="50" cy="50" r="50" /> : <rect width="100" height="100" />}</clipPath></defs>
            <g clipPath={`url(#${clipId})`}>
              <rect width="100" height="100" fill="#ffffff" />
              <image href={source.src} x={(100 - width * crop.zoom) / 2 + crop.x} y={(100 - height * crop.zoom) / 2 + crop.y}
                width={width * crop.zoom} height={height * crop.zoom} />
            </g>
          </svg>
          <input className="room-map-avatar-zoom" aria-label="头像缩放" title="缩放头像" type="range" min="1" max="5" step="0.01" value={crop.zoom}
            onChange={event => setCrop(current => constrain({ ...current, zoom: Number(event.target.value) }))} />
        </> : <button type="button" className="room-map-avatar-empty" disabled={loading} onClick={() => input.current?.click()}>
          {loading ? '读取中…' : '拖动至此上传'}
        </button>}
      </div>
      {source && <div className="room-map-avatar-actions">
        <div role="group" aria-label="头像形状">
          <button type="button" aria-pressed={shape === 'square'} onClick={() => setShape('square')}>方</button>
          <button type="button" aria-pressed={shape === 'circle'} onClick={() => setShape('circle')}>圆</button>
        </div>
        <div>
          <button type="button" disabled={loading} onClick={confirm}>确定</button>
          <button type="button" onClick={cancel}>取消</button>
        </div>
      </div>}
      {error && <p className="room-map-avatar-error" role="alert">{error}</p>}
    </div>
  )
}
