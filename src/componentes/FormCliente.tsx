// Campos do cadastro do cliente (usado no cadastro novo, na edição e no novo empréstimo)
import { useState } from 'react';
import { buscarCep, cpfValido, problemaNoCadastro, soNumeros, UFS, type DadosCliente } from '../lib/clientes';
import { CADASTRO_SIMPLES } from '../marca';

type Props = {
  dados: DadosCliente;
  aoMudar: (dados: DadosCliente) => void;
  simples?: boolean;
};

export function validarCliente(d: DadosCliente): string | null {
  return problemaNoCadastro(d, CADASTRO_SIMPLES);
}

export function FormCliente({ dados, aoMudar, simples = CADASTRO_SIMPLES }: Props) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCep, setAvisoCep] = useState('');
  // Na edição, já abre se o cliente tiver algum dado além do básico
  const [maisDados, setMaisDados] = useState(() =>
    (['cpf', 'data_nascimento', 'email', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'observacoes'] as const).some((c) =>
      dados[c].trim(),
    ),
  );
  const campo = (nome: keyof DadosCliente) => ({
    value: dados[nome],
    onChange: (e: { target: { value: string } }) => aoMudar({ ...dados, [nome]: e.target.value }),
  });

  async function aoMudarCep(valor: string) {
    const novo = { ...dados, cep: valor };
    aoMudar(novo);
    setAvisoCep('');
    if (soNumeros(valor).length === 8) {
      setBuscandoCep(true);
      const endereco = await buscarCep(valor);
      setBuscandoCep(false);
      if (endereco) aoMudar({ ...novo, ...endereco });
      else setAvisoCep('CEP não encontrado. Preencha o endereço à mão.');
    }
  }

  const cpfDigitado = soNumeros(dados.cpf).length === 11;
  const exigido = !simples;

  const nome = (
    <label>
      {simples ? 'Nome' : 'Nome completo'}
      <input required autoComplete="off" maxLength={120} {...campo('nome')} />
    </label>
  );
  const whatsapp = (
    <label>
      WhatsApp (com DDD)
      <input type="tel" inputMode="tel" placeholder="(11) 91234-5678" required {...campo('whatsapp')} />
    </label>
  );
  const indicacao = (
    <label>
      Indicado por (opcional)
      <input autoComplete="off" maxLength={120} placeholder="Quem indicou este cliente" {...campo('indicacao')} />
    </label>
  );
  const cpf = (
    <label>
      {exigido ? 'CPF' : 'CPF (opcional)'}
      <input inputMode="numeric" placeholder="000.000.000-00" required={exigido} {...campo('cpf')} />
      {cpfDigitado && !cpfValido(dados.cpf) && <span className="ajuda erro-texto">CPF inválido: confira os números.</span>}
    </label>
  );
  const nascimento = (
    <label>
      Data de nascimento (opcional)
      <input type="date" {...campo('data_nascimento')} />
    </label>
  );
  const email = (
    <label>
      E-mail (opcional)
      <input type="email" inputMode="email" autoComplete="off" {...campo('email')} />
    </label>
  );
  const endereco = (
    <fieldset className="grupo">
      <legend>{exigido ? 'Endereço' : 'Endereço (opcional)'}</legend>
      <label>
        CEP
        <input inputMode="numeric" placeholder="00000-000" required={exigido} value={dados.cep} onChange={(e) => aoMudarCep(e.target.value)} />
        <span className="ajuda">{buscandoCep ? 'Buscando endereço…' : avisoCep || 'Digite o CEP para preencher o endereço automaticamente.'}</span>
      </label>
      <label>
        Rua / avenida
        <input required={exigido} maxLength={200} {...campo('logradouro')} />
      </label>
      <div className="dupla">
        <label>
          Número
          <input required={exigido} maxLength={20} {...campo('numero')} />
        </label>
        <label>
          Complemento
          <input maxLength={100} placeholder="opcional" {...campo('complemento')} />
        </label>
      </div>
      <label>
        Bairro
        <input required={exigido} maxLength={100} {...campo('bairro')} />
      </label>
      <div className="dupla larga">
        <label>
          Cidade
          <input required={exigido} maxLength={100} {...campo('cidade')} />
        </label>
        <label>
          UF
          <select required={exigido} {...campo('uf')}>
            <option value="">—</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </label>
      </div>
    </fieldset>
  );
  const observacoes = (
    <fieldset className="grupo">
      <legend>Observações (opcional)</legend>
      <textarea rows={3} maxLength={1000} placeholder="Ex.: ponto de referência…" {...campo('observacoes')} aria-label="Observações" />
    </fieldset>
  );

  if (simples) {
    return (
      <>
        <fieldset className="grupo">
          {nome}
          {whatsapp}
          {indicacao}
        </fieldset>
        <button type="button" className="link mais-dados" aria-expanded={maisDados} onClick={() => setMaisDados((v) => !v)}>
          {maisDados ? '− Menos dados' : '+ Mais dados (CPF, endereço…)'}
        </button>
        {maisDados && (
          <>
            <fieldset className="grupo">
              {cpf}
              {nascimento}
              {email}
            </fieldset>
            {endereco}
            {observacoes}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <fieldset className="grupo">
        <legend>Identificação</legend>
        {nome}
        {cpf}
        {nascimento}
      </fieldset>
      <fieldset className="grupo">
        <legend>Contato</legend>
        {whatsapp}
        {email}
        {indicacao}
      </fieldset>
      {endereco}
      {observacoes}
    </>
  );
}
