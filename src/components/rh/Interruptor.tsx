'use client'

export function Interruptor({ nome, rotulo, padrao }: { nome: string; rotulo: string; padrao: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-borda px-3 py-2.5">
      <span className="font-medium">{rotulo}</span>
      <input type="checkbox" name={nome} defaultChecked={padrao} className="size-5 accent-[var(--primaria)]" />
      {/* Checkbox desmarcado não vai no formulário; isto avisa que o campo existia. */}
      <input type="hidden" name={`${nome}__presente`} value="1" />
    </label>
  )
}
