'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { enviarCodigo, verificarCodigo } from './acoes'

export function FormularioEntrada({ semAcesso }: { semAcesso: boolean }) {
  const router = useRouter()
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(semAcesso ? 'Seu acesso não está ativo. Fale com o RH.' : null)
  const [pendente, iniciar] = useTransition()

  function pedirCodigo(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    iniciar(async () => {
      const r = await enviarCodigo(email)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setEtapa('codigo')
    })
  }

  function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    iniciar(async () => {
      const r = await verificarCodigo(email, codigo)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      router.replace(r.destino)
      router.refresh()
    })
  }

  if (etapa === 'email') {
    return (
      <form onSubmit={pedirCodigo} className="flex flex-col gap-5">
        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@empresa.com.br"
          erro={erro ?? undefined}
        />
        <Botao type="submit" disabled={pendente}>{pendente ? 'Enviando código…' : 'Receber código por e-mail'}</Botao>
      </form>
    )
  }

  return (
    <form onSubmit={entrar} className="flex flex-col gap-5">
      <p className="text-texto-suave">
        Se <strong className="text-texto">{email.trim().toLowerCase()}</strong> estiver cadastrado, você vai receber um código de acesso.
      </p>
      <Campo
        rotulo="Código"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6,10}"
        maxLength={10}
        required
        autoFocus
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
        className="[&_input]:numeros [&_input]:text-2xl [&_input]:tracking-[0.4em]"
        erro={erro ?? undefined}
      />
      <Botao type="submit" disabled={pendente || codigo.length < 6}>{pendente ? 'Entrando…' : 'Entrar'}</Botao>
      <Botao type="button" variante="fantasma" onClick={() => { setEtapa('email'); setCodigo(''); setErro(null) }}>
        Usar outro e-mail
      </Botao>
    </form>
  )
}
