'use client'

import { useEffect, useRef } from 'react'

// Fundo animado inspirado no site da Timenow: pontos de luz ligados por linhas finas,
// deslizando numa faixa diagonal, com brilho no canto e luzes desfocadas ao fundo.
// Fica parado com "reduzir movimento" e pausa quando a aba não está visível.

type Ponto = { x: number; y: number; vx: number; vy: number; r: number; brilho: number }
type Luz = { x: number; y: number; r: number; alfa: number; vx: number; vy: number }

const DISTANCIA_LIGACAO = 170
// Só liga pontos quase alinhados com a diagonal: forma fios, não uma teia.
const ALINHAMENTO_MINIMO = 0.86
const DIRECAO = { x: Math.cos(-0.42), y: Math.sin(-0.42) } // sobe da esquerda para a direita

// Gerador previsível, para o desenho não "pular" entre renderizações.
function aleatorio(semente: number) {
  let s = semente
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function criarCena(largura: number, altura: number) {
  const rnd = aleatorio(42)
  const area = largura * altura
  const total = Math.round(Math.min(180, Math.max(60, area / 6000)))
  const pontos: Ponto[] = Array.from({ length: total }, () => {
    // Concentra os pontos numa faixa diagonal, como fibras de luz.
    const t = rnd()
    const afastamento = (rnd() - 0.5) * altura * 0.4 * (0.3 + rnd())
    const baseX = t * largura * 1.3 - largura * 0.15
    const baseY = altura * 0.95 - t * altura * 0.75
    const velocidade = 0.08 + rnd() * 0.18
    return {
      x: baseX - DIRECAO.y * afastamento,
      y: baseY + DIRECAO.x * afastamento,
      vx: DIRECAO.x * velocidade,
      vy: DIRECAO.y * velocidade,
      r: 0.8 + rnd() * 2.2,
      brilho: 0.4 + rnd() * 0.6,
    }
  })
  const luzes: Luz[] = Array.from({ length: 18 }, () => ({
    x: rnd() * largura,
    y: altura * 0.25 + rnd() * altura * 0.8,
    r: 18 + rnd() * 70,
    alfa: 0.08 + rnd() * 0.24,
    vx: DIRECAO.x * (0.03 + rnd() * 0.06),
    vy: DIRECAO.y * (0.03 + rnd() * 0.06),
  }))
  return { pontos, luzes }
}

function desenhar(ctx: CanvasRenderingContext2D, largura: number, altura: number, cena: ReturnType<typeof criarCena>) {
  const fundo = ctx.createLinearGradient(0, 0, largura, altura)
  fundo.addColorStop(0, '#0c4a52')
  fundo.addColorStop(0.45, '#072b33')
  fundo.addColorStop(1, '#020c10')
  ctx.fillStyle = fundo
  ctx.fillRect(0, 0, largura, altura)

  const brilho = ctx.createRadialGradient(largura * 0.08, altura * 0.12, 0, largura * 0.08, altura * 0.12, Math.max(largura, altura) * 0.7)
  brilho.addColorStop(0, 'rgba(215, 251, 255, 0.95)')
  brilho.addColorStop(0.3, 'rgba(95, 205, 225, 0.45)')
  brilho.addColorStop(1, 'rgba(95, 205, 225, 0)')
  ctx.fillStyle = brilho
  ctx.fillRect(0, 0, largura, altura)

  for (const l of cena.luzes) {
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r)
    g.addColorStop(0, `rgba(120, 225, 245, ${l.alfa})`)
    g.addColorStop(0.6, `rgba(120, 225, 245, ${l.alfa * 0.6})`)
    g.addColorStop(1, 'rgba(120, 225, 245, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2)
    ctx.fill()
  }

  const { pontos } = cena
  ctx.lineWidth = 0.7
  for (let i = 0; i < pontos.length; i++) {
    for (let j = i + 1; j < pontos.length; j++) {
      const dx = pontos[i].x - pontos[j].x
      const dy = pontos[i].y - pontos[j].y
      const d = Math.hypot(dx, dy)
      if (d < DISTANCIA_LIGACAO && Math.abs((dx * DIRECAO.x + dy * DIRECAO.y) / d) > ALINHAMENTO_MINIMO) {
        ctx.strokeStyle = `rgba(160, 232, 245, ${(1 - d / DISTANCIA_LIGACAO) * 0.6})`
        ctx.beginPath()
        ctx.moveTo(pontos[i].x, pontos[i].y)
        ctx.lineTo(pontos[j].x, pontos[j].y)
        ctx.stroke()
      }
    }
  }
  for (const p of pontos) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4)
    g.addColorStop(0, `rgba(225, 252, 255, ${p.brilho})`)
    g.addColorStop(0.35, `rgba(120, 220, 240, ${p.brilho * 0.5})`)
    g.addColorStop(1, 'rgba(120, 220, 240, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function avancar(cena: ReturnType<typeof criarCena>, largura: number, altura: number) {
  const margem = 80
  for (const p of [...cena.pontos, ...cena.luzes]) {
    p.x += p.vx
    p.y += p.vy
    // Saiu pela direita/topo: volta pela esquerda/baixo, mantendo a faixa.
    if (p.x > largura + margem || p.y < -margem) {
      p.x -= largura + margem * 2
      p.y += (largura + margem * 2) * (-DIRECAO.y / DIRECAO.x)
    }
    if (p.y > altura + margem * 4) p.y -= altura + margem * 4
  }
}

export function FundoRede({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let largura = 0
    let altura = 0
    let cena = criarCena(1, 1)
    let quadro = 0

    // Escondido (display:none) o canvas fica 0×0: não desenha nem mantém o laço rodando.
    const visivel = () => largura > 0 && altura > 0
    const animar = () => {
      cancelAnimationFrame(quadro)
      if (!parado && !document.hidden && visivel()) quadro = requestAnimationFrame(passo)
    }
    const ajustar = () => {
      const escala = Math.min(window.devicePixelRatio || 1, 1.5)
      largura = canvas.clientWidth
      altura = canvas.clientHeight
      if (!visivel()) {
        cancelAnimationFrame(quadro)
        return
      }
      canvas.width = Math.round(largura * escala)
      canvas.height = Math.round(altura * escala)
      ctx.setTransform(escala, 0, 0, escala, 0, 0)
      cena = criarCena(largura, altura)
      desenhar(ctx, largura, altura, cena)
      animar()
    }
    const passo = () => {
      if (!visivel()) return
      avancar(cena, largura, altura)
      desenhar(ctx, largura, altura, cena)
      quadro = requestAnimationFrame(passo)
    }

    ajustar()
    const observador = new ResizeObserver(ajustar)
    observador.observe(canvas)
    if (!parado) document.addEventListener('visibilitychange', animar)
    return () => {
      cancelAnimationFrame(quadro)
      observador.disconnect()
      document.removeEventListener('visibilitychange', animar)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className={`absolute inset-0 h-full w-full ${className}`} />
}
