// O PostgREST devolve no máximo 1000 linhas por leitura. Pede página por página, com .range(), até
// vir uma página incompleta. A consulta precisa ter ordem estável para as páginas não se repetirem.
type Resposta<T> = { data: T[] | null; error: { message: string } | null }

export async function lerTodas<T>(
  pagina: (de: number, ate: number) => PromiseLike<Resposta<T>>,
  tamanho = 1000,
): Promise<Resposta<T>> {
  const todas: T[] = []
  for (let de = 0; ; de += tamanho) {
    const r = await pagina(de, de + tamanho - 1)
    if (r.error || r.data === null) return { data: null, error: r.error ?? { message: 'sem dados' } }
    todas.push(...r.data)
    if (r.data.length < tamanho) return { data: todas, error: null }
  }
}
