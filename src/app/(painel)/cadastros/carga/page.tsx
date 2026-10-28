import { exigirRh } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Voltar } from '../Voltar'
import { CargaInicial } from './Cliente'

export default async function Carga() {
  await exigirRh()
  const { count } = await (await criarClienteServidor()).from('vagas').select('id', { count: 'exact', head: true })
  return (
    <>
      <Voltar titulo="Carga inicial" />
      <p className="mb-4 max-w-prose text-texto-suave">Envie a planilha “Acompanhamento Mobilizações.xlsx”. Antes de importar, cadastre as ondas. O gestor de cada vaga fica vazio para preencher depois.</p>
      <CargaInicial podeImportar={!count} />
    </>
  )
}
