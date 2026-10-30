import type { ReactNode } from 'react';
import { calcularJuros, formatarReais, type ModoJuros } from '../lib/dinheiro';

type CampoDinheiroProps = {
  rotulo: string;
  valor: string;
  aoMudar: (texto: string) => void;
  ajuda?: ReactNode;
  obrigatorio?: boolean;
};

export function CampoDinheiro({ rotulo, valor, aoMudar, ajuda, obrigatorio }: CampoDinheiroProps) {
  return (
    <label>
      {rotulo}
      <span className="campo-prefixo">
        <span>R$</span>
        <input inputMode="decimal" placeholder="0,00" required={obrigatorio} value={valor} onChange={(e) => aoMudar(e.target.value)} />
      </span>
      {ajuda && <span className="ajuda">{ajuda}</span>}
    </label>
  );
}

type CampoJurosProps = {
  rotulo: string;
  modo: ModoJuros;
  texto: string;
  base: number; // valor (centavos) sobre o qual a % é calculada
  textoBase: string; // ex.: "do valor emprestado"
  aoMudar: (modo: ModoJuros, texto: string) => void;
};

// Juros em R$ ou em %. Em %, mostra quanto dá em reais (é o valor em reais que fica salvo).
export function CampoJuros({ rotulo, modo, texto, base, textoBase, aoMudar }: CampoJurosProps) {
  const calculado = calcularJuros(modo, texto, base);
  return (
    <div className="campo">
      <div className="campo-titulo">
        <span>{rotulo}</span>
        <span className="alternador" role="group" aria-label="Juros em reais ou porcentagem">
          <button type="button" className={modo === 'reais' ? 'ativo' : ''} onClick={() => aoMudar('reais', '')}>R$</button>
          <button type="button" className={modo === 'percentual' ? 'ativo' : ''} onClick={() => aoMudar('percentual', '')}>%</button>
        </span>
      </div>
      <span className="campo-prefixo">
        <span>{modo === 'reais' ? 'R$' : '%'}</span>
        <input
          inputMode="decimal"
          placeholder={modo === 'reais' ? '0,00' : 'ex.: 10'}
          required
          value={texto}
          onChange={(e) => aoMudar(modo, e.target.value)}
          aria-label={rotulo}
        />
      </span>
      {modo === 'percentual' && (
        <span className="ajuda">
          {calculado === null ? `Porcentagem ${textoBase}.` : `${texto}% ${textoBase} = ${formatarReais(calculado)} (é este valor que fica salvo)`}
        </span>
      )}
    </div>
  );
}
