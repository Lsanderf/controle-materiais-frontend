import { isValidNfeAccessKey } from './nfeBarcode.js';

export const NFE_XML_KEY_MISMATCH_MESSAGE =
  'A chave da NF-e informada é diferente da chave presente no XML.';

export function nfeXmlComparisonKey(value) {
  return isValidNfeAccessKey(value) ? onlyDigits(value) : '';
}

export function formFromImportedNfe(currentForm, importedNfe, comparisonKey) {
  const normalizedComparison = nfeXmlComparisonKey(comparisonKey);
  const importedKey = onlyDigits(importedNfe?.chaveAcesso);

  if (normalizedComparison && normalizedComparison !== importedKey) {
    throw new Error(NFE_XML_KEY_MISMATCH_MESSAGE);
  }

  return {
    ...currentForm,
    numero: importedNfe?.numero ?? '',
    serie: importedNfe?.serie ?? '',
    chaveAcesso: importedKey,
    fornecedor: importedNfe?.fornecedor ?? '',
    cnpjFornecedor: importedNfe?.cnpjFornecedor ?? '',
    dataEmissao: importedNfe?.dataEmissao ?? '',
    itens: (importedNfe?.itens ?? []).map((item, index) => ({
      materialId: '',
      quantidade: decimalInput(item.quantidadeComercial),
      valorUnitario: decimalInput(item.valorUnitarioComercial),
      origemXml: {
        numeroItem: item.numeroItem ?? index + 1,
        codigoProduto: item.codigoProduto ?? '',
        descricaoProduto: item.descricaoProduto ?? '',
        quantidadeComercial: decimalInput(item.quantidadeComercial),
        unidadeComercial: item.unidadeComercial ?? '',
        valorUnitarioComercial: decimalInput(
          item.valorUnitarioComercial,
        ),
        valorTotal: decimalInput(item.valorTotal),
        eanGtin: item.eanGtin ?? '',
      },
    })),
  };
}

export function associateImportedMaterial(form, itemIndex, materialId) {
  return {
    ...form,
    itens: (form.itens ?? []).map((item, index) =>
      index === itemIndex
        ? { ...item, materialId: String(materialId ?? '') }
        : item,
    ),
  };
}

export function hasUnmappedImportedItems(form) {
  return (form?.itens ?? []).some(
    (item) => Boolean(item.origemXml) && !item.materialId,
  );
}

function decimalInput(value) {
  return value === null || value === undefined ? '' : String(value);
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}
