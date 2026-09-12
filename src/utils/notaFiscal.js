import {
  INVALID_NFE_ACCESS_KEY_MESSAGE,
  isValidNfeAccessKey,
} from './nfeBarcode.js';

const MANAGER_ROLES = new Set(['ADMIN', 'OPERADOR']);
const MAX_ITEM_QUANTITY = 10000;

export const notaFiscalStatusLabels = {
  RASCUNHO: 'Rascunho',
  CONFIRMADA: 'Confirmada',
};

export function canManageNotaFiscal(role) {
  return MANAGER_ROLES.has(role);
}

export function canEditNotaFiscal(notaFiscal, role) {
  return canManageNotaFiscal(role) && notaFiscal?.status === 'RASCUNHO';
}

export function canConfirmNotaFiscal(notaFiscal, role) {
  return (
    canEditNotaFiscal(notaFiscal, role) &&
    Array.isArray(notaFiscal.itens) &&
    notaFiscal.itens.length > 0
  );
}

export function emptyNotaFiscalItem() {
  return {
    materialId: '',
    quantidade: '',
    valorUnitario: '',
  };
}

export function emptyNotaFiscalForm() {
  return {
    numero: '',
    serie: '',
    chaveAcesso: '',
    fornecedor: '',
    cnpjFornecedor: '',
    dataEmissao: '',
    itens: [emptyNotaFiscalItem()],
  };
}

export function formFromNotaFiscal(notaFiscal) {
  return {
    numero: notaFiscal.numero ?? '',
    serie: notaFiscal.serie ?? '',
    chaveAcesso: notaFiscal.chaveAcesso ?? '',
    fornecedor: notaFiscal.fornecedor ?? '',
    cnpjFornecedor: notaFiscal.cnpjFornecedor ?? '',
    dataEmissao: notaFiscal.dataEmissao ?? '',
    itens:
      notaFiscal.itens?.map((item) => ({
        materialId: String(item.materialId ?? ''),
        quantidade: String(item.quantidade ?? ''),
        valorUnitario: formatDecimalInput(item.valorUnitario),
      })) ?? [],
  };
}

export function buildNotaFiscalPayload(form) {
  return {
    numero: form.numero.trim(),
    serie: form.serie.trim(),
    chaveAcesso: form.chaveAcesso.trim(),
    fornecedor: form.fornecedor.trim(),
    cnpjFornecedor: form.cnpjFornecedor.trim(),
    dataEmissao: form.dataEmissao,
    itens: (form.itens ?? []).map((item) => ({
      materialId: Number(item.materialId),
      quantidade: Number(item.quantidade),
      valorUnitario: normalizeMoneyInput(item.valorUnitario),
    })),
  };
}

export function validateNotaFiscalForm(form) {
  if (!form.numero.trim()) return 'Informe o numero da nota fiscal.';
  if (!form.serie.trim()) return 'Informe a serie da nota fiscal.';
  if (!form.chaveAcesso.trim()) return 'Informe a chave de acesso.';
  if (!/^[0-9.\-/\s]+$/.test(form.chaveAcesso.trim())) {
    return 'A chave de acesso deve conter apenas numeros e formatacao.';
  }
  if (onlyDigits(form.chaveAcesso).length !== 44) {
    return 'A chave de acesso deve conter exatamente 44 digitos.';
  }
  const accessKeyCheckDigitError = validateNfeAccessKeyCheckDigit(
    form.chaveAcesso,
  );
  if (accessKeyCheckDigitError) return accessKeyCheckDigitError;
  if (!form.fornecedor.trim()) return 'Informe o fornecedor.';
  if (!form.cnpjFornecedor.trim()) return 'Informe o CNPJ do fornecedor.';
  if (onlyDigits(form.cnpjFornecedor).length !== 14) {
    return 'O CNPJ do fornecedor deve conter 14 digitos.';
  }
  if (!form.dataEmissao) return 'Informe a data de emissao.';
  if (form.dataEmissao > todayIsoDate()) {
    return 'A data de emissao nao pode estar no futuro.';
  }

  for (const [index, item] of (form.itens ?? []).entries()) {
    const label = `Item ${index + 1}`;
    if (!item.materialId) return `${label}: selecione um material.`;
    const quantity = Number(item.quantidade);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return `${label}: a quantidade deve ser um numero inteiro maior que zero.`;
    }
    if (quantity > MAX_ITEM_QUANTITY) {
      return `${label}: a quantidade maxima por item e 10.000.`;
    }
    if (item.valorUnitario === '') return `${label}: informe o valor unitario.`;
    const unitValue = Number(normalizeMoneyInput(item.valorUnitario));
    if (!Number.isFinite(unitValue) || unitValue < 0) {
      return `${label}: o valor unitario nao pode ser negativo.`;
    }
    if (!/^\d+([,.]\d{1,2})?$/.test(String(item.valorUnitario).trim())) {
      return `${label}: o valor unitario deve possuir ate 2 casas decimais.`;
    }
  }

  return '';
}

export function validateNfeAccessKeyCheckDigit(value) {
  const trimmed = String(value ?? '').trim();
  if (
    !trimmed ||
    !/^[0-9.\-/\s]+$/.test(trimmed) ||
    onlyDigits(trimmed).length !== 44
  ) {
    return '';
  }

  return isValidNfeAccessKey(trimmed)
    ? ''
    : INVALID_NFE_ACCESS_KEY_MESSAGE;
}

export function filterNotasFiscais(notasFiscais, search, status) {
  const term = normalizeSearch(search);
  return sortNotasFiscais(notasFiscais).filter((notaFiscal) => {
    const statusMatches =
      status === 'TODOS' || notaFiscal.status === status;
    const searchMatches =
      !term ||
      [
        notaFiscal.id,
        notaFiscal.numero,
        notaFiscal.serie,
        notaFiscal.chaveAcesso,
        notaFiscal.fornecedor,
        notaFiscal.cnpjFornecedor,
      ]
        .map((value) => normalizeSearch(value))
        .some((value) => value.includes(term));

    return statusMatches && searchMatches;
  });
}

export function sortNotasFiscais(notasFiscais) {
  return [...(notasFiscais ?? [])].sort(
    (a, b) => parseNotaFiscalDate(b) - parseNotaFiscalDate(a) || b.id - a.id,
  );
}

export function notaFiscalStatusLabel(status) {
  return notaFiscalStatusLabels[status] ?? status;
}

export function notaFiscalErrorMessage(error) {
  const fieldMessages = error?.fields ? Object.values(error.fields) : [];
  return [error?.message, ...fieldMessages].filter(Boolean).join(' ');
}

export function formatNotaFiscalDate(value) {
  if (!value) return '-';
  const dateOnly = String(value).split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('pt-BR').format(
    new Date(year, month - 1, day),
  );
}

export function formatNotaFiscalDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

export function formatCurrency(value) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatChaveAcesso(value) {
  return onlyDigits(value).replace(/(.{4})(?=.)/g, '$1 ');
}

export function formatCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeMoneyInput(value) {
  return String(value ?? '').trim().replace(',', '.');
}

function formatDecimalInput(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeSearch(value) {
  return String(value ?? '').trim().toLocaleLowerCase('pt-BR');
}

function parseNotaFiscalDate(notaFiscal) {
  const value =
    notaFiscal.dataEntrada ?? notaFiscal.dataCadastro ?? notaFiscal.dataEmissao;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}
