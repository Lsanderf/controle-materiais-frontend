function normalize(value) {
  return String(value ?? '').toLocaleLowerCase('pt-BR');
}

export function filterBySearchAndStatus(
  records,
  search,
  status,
  searchableValues,
) {
  const term = normalize(search).trim();

  return records.filter((record) => {
    const values = searchableValues(record);
    const matchesSearch =
      !term || values.some((value) => normalize(value).includes(term));
    const matchesStatus =
      status === 'TODOS' ||
      (status === 'ATIVOS' && record.ativo) ||
      (status === 'INATIVOS' && !record.ativo);

    return matchesSearch && matchesStatus;
  });
}
