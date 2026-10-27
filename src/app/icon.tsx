import { ImageResponse } from 'next/og'
import { SimboloIcone } from './simboloIcone'

export const contentType = 'image/png'

export function generateImageMetadata() {
  return [192, 512].map((n) => ({ id: String(n), size: { width: n, height: n }, contentType }))
}

export default async function Icon({ id }: { id: Promise<string> | string }) {
  const n = Number(await id) || 192
  return new ImageResponse(<SimboloIcone tamanho={n} />, { width: n, height: n })
}
