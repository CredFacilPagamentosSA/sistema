// Campos do cadastro do cliente (usado no cadastro novo, na edição e no novo empréstimo)
import { useState } from 'react';
import { buscarCep, cpfValido, soNumeros, UFS, type DadosCliente } from '../lib/clientes';

type Props = {
  dados: DadosCliente;
  aoMudar: (dados: DadosCliente) => void;
};

// Campos que o app exige (o banco aceita vazio só por causa dos clientes antigos)
export function validarCliente(d: DadosCliente): string | null {
  if (!d.nome.trim()) return 'Informe o nome do cliente.';
  const tel = soNumeros(d.whatsapp);
  if (!(tel.length === 10 || tel.length === 11 || ((tel.length === 12 || tel.length === 13) && tel.startsWith('55')))) {
    return 'WhatsApp inválido: informe DDD + número, por exemplo (11) 91234-5678.';
  }
  if (!d.cpf.trim()) return 'Informe o CPF do cliente.';
  if (!cpfValido(d.cpf)) return 'CPF inválido: confira os números.';
  if (d.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) return 'E-mail inválido.';
  if (soNumeros(d.cep).length !== 8) return 'Informe o CEP (8 números).';
  if (!d.logradouro.trim()) return 'Informe a rua / avenida do endereço.';
  if (!d.numero.trim()) return 'Informe o número do endereço (ou "s/n").';
  if (!d.bairro.trim()) return 'Informe o bairro.';
  if (!d.cidade.trim()) return 'Informe a cidade.';
  if (!d.uf) return 'Informe o estado (UF).';
  return null;
}

export function FormCliente({ dados, aoMudar }: Props) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCep, setAvisoCep] = useState('');
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

  return (
    <>
      <fieldset className="grupo">
        <legend>Identificação</legend>
        <label>
          Nome completo
          <input required autoComplete="off" maxLength={120} {...campo('nome')} />
        </label>
        <label>
          CPF
          <input inputMode="numeric" placeholder="000.000.000-00" required {...campo('cpf')} />
          {cpfDigitado && !cpfValido(dados.cpf) && <span className="ajuda erro-texto">CPF inválido: confira os números.</span>}
        </label>
        <label>
          Data de nascimento (opcional)
          <input type="date" {...campo('data_nascimento')} />
        </label>
      </fieldset>

      <fieldset className="grupo">
        <legend>Contato</legend>
        <label>
          WhatsApp (com DDD)
          <input type="tel" inputMode="tel" placeholder="(11) 91234-5678" required {...campo('whatsapp')} />
        </label>
        <label>
          E-mail (opcional)
          <input type="email" inputMode="email" autoComplete="off" {...campo('email')} />
        </label>
      </fieldset>

      <fieldset className="grupo">
        <legend>Endereço</legend>
        <label>
          CEP
          <input inputMode="numeric" placeholder="00000-000" required value={dados.cep} onChange={(e) => aoMudarCep(e.target.value)} />
          <span className="ajuda">{buscandoCep ? 'Buscando endereço…' : avisoCep || 'Digite o CEP para preencher o endereço automaticamente.'}</span>
        </label>
        <label>
          Rua / avenida
          <input required maxLength={200} {...campo('logradouro')} />
        </label>
        <div className="dupla">
          <label>
            Número
            <input required maxLength={20} {...campo('numero')} />
          </label>
          <label>
            Complemento
            <input maxLength={100} placeholder="opcional" {...campo('complemento')} />
          </label>
        </div>
        <label>
          Bairro
          <input required maxLength={100} {...campo('bairro')} />
        </label>
        <div className="dupla larga">
          <label>
            Cidade
            <input required maxLength={100} {...campo('cidade')} />
          </label>
          <label>
            UF
            <select required {...campo('uf')}>
              <option value="">—</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>Observações (opcional)</legend>
        <textarea rows={3} maxLength={1000} placeholder="Ex.: indicado por fulano, ponto de referência…" {...campo('observacoes')} aria-label="Observações" />
      </fieldset>
    </>
  );
}
