// Ajuste único: etapas importadas como concluídas com data futura (a data planejada da planilha)
// passam a valer hoje, com registro no histórico de cada vaga. Uso: npm run ajustar-datas-futuras
import pg from 'pg'

const senha = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)
const c = new pg.Client({
  connectionString: `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${senha}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
try {
  await c.query('begin')
  const { rows } = await c.query(`
    with futuras as (
      select vaga_id, ordem, concluida_em from vaga_conclusoes where concluida_em > hoje_sp()
    ), ajustadas as (
      update vaga_conclusoes vc set concluida_em = hoje_sp()
      from futuras f where vc.vaga_id = f.vaga_id and vc.ordem = f.ordem
      returning vc.vaga_id
    )
    insert into historico (vaga_id, nome_usuario, acao, detalhe)
    select vaga_id, 'Ajuste da carga', 'Datas futuras da planilha passaram para hoje',
           jsonb_build_object('etapas', jsonb_agg(jsonb_build_object('ordem', ordem, 'data_planilha', concluida_em) order by ordem))
    from futuras group by vaga_id
    returning vaga_id`)
  await c.query('commit')
  console.log(`Ajustado: ${rows.length} vagas.`)
} catch (e) {
  await c.query('rollback')
  console.error('Nada foi alterado:', e.message)
  process.exitCode = 1
} finally {
  await c.end()
}
