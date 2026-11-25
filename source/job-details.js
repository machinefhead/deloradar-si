// Skupna polja, ki jih vir sam izrecno objavi v shemi JobPosting.
// Ne dopolnjujemo neznanih vrednosti z ugibanjem in ne zbiramo kontaktov oseb.

function decodeEntities(value) {
  const named = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', ndash: '–', mdash: '—', bull: '•' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

export function readableJobText(value) {
  if (Array.isArray(value)) return value.map(readableJobText).filter(Boolean).join('\n');
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const raw = String(value);
  return decodeEntities(raw
    .replace(/<\s*br\b[^>]*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|div|li|ul|ol|h[1-6]|tr|section)\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n• ')
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n?/g, '\n'))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n{2,}(?=• )/g, '\n')
    .trim();
}

function detailText(value) {
  if (Array.isArray(value)) return value.map(detailText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const detail = [value.name, value.credentialCategory, value.description, value.about]
      .map(readableJobText).filter(Boolean).join(' — ');
    if (detail) return detail;
    if (Number.isFinite(Number(value.monthsOfExperience)) && value.monthsOfExperience !== '') {
      return String(value.monthsOfExperience) + ' mesecev izkušenj';
    }
    return '';
  }
  return readableJobText(value);
}

function salaryValue(value) {
  if (typeof value === 'string' || typeof value === 'number') return readableJobText(value);
  if (!value || typeof value !== 'object') return null;
  const amount = value.value && typeof value.value === 'object' ? value.value : value;
  const result = {};
  const currency = readableJobText(value.currency || '');
  if (currency) result.currency = currency;
  for (const key of ['value', 'minValue', 'maxValue']) {
    const numeric = Number(amount[key]);
    if (amount[key] !== undefined && amount[key] !== null && String(amount[key]).trim() !== '' &&
        Number.isFinite(numeric) && numeric >= 0) result[key] = numeric;
  }
  const unit = readableJobText(amount.unitText || '');
  if (unit) result.unit = unit;
  return Object.keys(result).length ? result : null;
}

export function jobPostingDetails(data) {
  if (!data || typeof data !== 'object') return {};
  const result = {};
  const mappings = {
    description: 'description', employmentType: 'employmentType', workHours: 'workHours',
    responsibilities: 'responsibilities', requirements: 'qualifications',
    benefits: 'jobBenefits', education: 'educationRequirements',
    experience: 'experienceRequirements', workplaceType: 'jobLocationType',
    incentives: 'incentiveCompensation', skills: 'skills',
  };
  for (const [target, source] of Object.entries(mappings)) {
    const value = detailText(data[source]);
    if (value) result[target] = value;
  }
  const salary = salaryValue(data.baseSalary);
  if (salary) result.salary = salary;
  return result;
}
