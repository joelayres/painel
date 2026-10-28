'use client'

import { FormProjeto, type ProjetoEditavel } from '@/app/(painel)/FormProjeto'

// Dados do projeto: resumo e edição (o cliente aparece só para leitura). Encerrado, só o resumo.
export function DadosProjeto({ projeto, somenteLeitura }: { projeto: ProjetoEditavel; somenteLeitura: boolean }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-borda bg-superficie p-4">
      <dl className="grid gap-3 sm:grid-cols-4">
        {[
          ['Cliente', projeto.clienteNome],
          ['Nome', projeto.nome],
          ['Área', projeto.area ?? '—'],
          ['Organização', projeto.organizacao === 'ondas' ? 'Por ondas' : 'Por meta'],
        ].map(([t, v]) => (
          <div key={t}><dt className="text-sm text-texto-suave">{t}</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
      {!somenteLeitura && <div><FormProjeto projeto={projeto} /></div>}
    </div>
  )
}
