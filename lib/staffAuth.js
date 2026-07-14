import { supabase } from './supabaseClient';

// Valida o código de acesso contra a tabela staff_codigos.
// Mesmo padrão do app financeiro: não é autenticação real (RLS continua aberto),
// é uma trava de UX pra impedir acesso casual ao painel.
export async function validarCodigoAcesso(codigo) {
  const { data, error } = await supabase
    .from('staff_codigos')
    .select('*')
    .eq('codigo_acesso', codigo)
    .eq('ativo', true)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
