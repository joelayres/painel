import type { Perfil } from './perfil'

// Todo mundo cai no painel; quem não tem perfil ativo volta para a entrada com o aviso.
export function rotaInicial(perfil: Perfil | null): string {
  return perfil === null ? '/entrar?erro=sem-acesso' : '/'
}
