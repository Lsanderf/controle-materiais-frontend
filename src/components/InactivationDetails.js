import { createElement } from 'react';
import { formatInactivationDate } from '../utils/formatters.js';

export function MobileInactivationDetails({ record }) {
  if (record?.ativo !== false) return null;

  return createElement(
    'p',
    { className: 'inactivation-info' },
    createElement('span', null, 'Inativo desde:'),
    createElement('strong', null, formatInactivationDate(record)),
  );
}

export function InactivationTableValue({ record }) {
  return createElement(
    'span',
    { className: 'inactivation-date' },
    formatInactivationDate(record),
  );
}
