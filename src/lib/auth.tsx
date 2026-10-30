// Guarda quem está logado e qual o perfil (administrador ou atendente)
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Perfil = {
  id: string;
  nome: string;
  email: string;
  perfil: 'admin' | 'atendente';
  ativo: boolean;
};

type EstadoAuth = {
  carregando: boolean;
  sessao: Session | null;
  perfil: Perfil | null;
  ehAdmin: boolean;
  // true quando a pessoa chegou por link de recuperação de senha ou convite
  precisaDefinirSenha: boolean;
  senhaDefinida: () => void;
  recarregarPerfil: () => void;
  sair: () => Promise<void>;
};

const Contexto = createContext<EstadoAuth | null>(null);

// O link do e-mail traz "type=recovery" ou "type=invite"; lemos antes do Supabase limpar o endereço
const chegouPorLinkDeSenha = /type=(recovery|invite)/.test(window.location.hash + window.location.search);

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [precisaDefinirSenha, setPrecisaDefinirSenha] = useState(chegouPorLinkDeSenha);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      if (!data.session) setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      if (evento === 'PASSWORD_RECOVERY') setPrecisaDefinirSenha(true);
      setSessao(novaSessao);
      if (!novaSessao) {
        setPerfil(null);
        setCarregando(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const usuarioId = sessao?.user.id;
  const [versaoPerfil, setVersaoPerfil] = useState(0);
  useEffect(() => {
    if (!usuarioId) return;
    let cancelado = false;
    if (versaoPerfil === 0) setCarregando(true);
    supabase
      .from('perfis')
      .select('id, nome, email, perfil, ativo')
      .eq('id', usuarioId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado) return;
        setPerfil((data as Perfil | null) ?? null);
        setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [usuarioId, versaoPerfil]);

  const valor: EstadoAuth = {
    carregando,
    sessao,
    perfil,
    ehAdmin: perfil?.perfil === 'admin' && perfil.ativo,
    precisaDefinirSenha,
    senhaDefinida: () => setPrecisaDefinirSenha(false),
    recarregarPerfil: () => setVersaoPerfil((v) => v + 1),
    sair: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAuth precisa estar dentro de ProvedorAuth');
  return ctx;
}
