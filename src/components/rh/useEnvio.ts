'use client'

import { useState, useTransition, type FormEvent } from 'react'
export type RespostaAcao = { ok: true } | { ok: false; erros: Record<string, string> }

// Envia o formulário para uma server action e guarda os erros por campo.
type Dados = Record<string, FormDataEntryValue | FormDataEntryValue[]>

// Campos com nome terminado em "[]" (ex.: plantaIds[]) viram listas.
function lerFormulario(form: HTMLFormElement): Dados {
  const dados: Dados = {}
  const fd = new FormData(form)
  for (const chave of new Set(fd.keys())) {
    dados[chave.endsWith('[]') ? chave.slice(0, -2) : chave] = chave.endsWith('[]') ? fd.getAll(chave) : fd.get(chave)!
  }
  return dados
}

// `aoConcluir` recebe a resposta de sucesso (algumas ações devolvem mais que `ok`).
export function useEnvio<R extends RespostaAcao>(acao: (dados: Dados) => Promise<R>, aoConcluir: (r: Extract<R, { ok: true }>) => void) {
  const [erros, setErros] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const dados = lerFormulario(e.currentTarget)
    iniciar(async () => {
      const r = await acao(dados)
      if (r.ok) {
        setErros({})
        aoConcluir(r as Extract<R, { ok: true }>)
      } else {
        setErros(r.erros)
      }
    })
  }

  return { erros, pendente, enviar }
}
