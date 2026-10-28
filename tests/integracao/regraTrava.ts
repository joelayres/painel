// Regra da trava: só deixa os testes de integração rodarem com o banco sem vagas reais.
// Qualquer dúvida (erro, contagem ausente) bloqueia: este banco é o de produção.
const TABELA_AUSENTE = new Set(['42P01', 'PGRST205'])

export function conferirTrava(r: { count: number | null; error: { code?: string; message: string } | null }): void {
  if (r.error) {
    if (TABELA_AUSENTE.has(r.error.code ?? '')) return
    throw new Error(`Trava dos testes: não foi possível consultar o banco (${r.error.message}).`)
  }
  if (r.count === null) throw new Error('Trava dos testes: não foi possível consultar o banco (sem contagem).')
  if (r.count > 0) throw new Error(`Trava dos testes: o banco tem ${r.count} vagas reais. Os testes de integração não rodam no banco de produção.`)
}
