// Carrega dados do banco e recarrega sozinho quando o app volta a ficar visível
import { useCallback, useEffect, useState } from 'react';
import { mensagemDeErro } from './erros';

export function useCarregar<T>(buscar: () => Promise<T>, dependencias: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recarregar = useCallback(async () => {
    try {
      setDados(await buscar());
      setErro('');
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }, dependencias);

  useEffect(() => {
    setCarregando(true);
    recarregar();
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') recarregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [recarregar]);

  return { dados, erro, carregando, recarregar };
}

// Faz a consulta e transforma erro do Supabase em exceção
export async function consultar<T>(promessa: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promessa;
  if (error) throw error;
  return data as T;
}
