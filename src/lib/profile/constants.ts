export const DOMAINS = [
  { code: 'business', label: 'Business / professionnel' },
  { code: 'tech', label: 'Tech / informatique' },
  { code: 'medical', label: 'Médical / santé' },
  { code: 'legal', label: 'Juridique' },
  { code: 'academic', label: 'Académique / études' },
  { code: 'travel', label: 'Voyage / tourisme' },
  { code: 'everyday', label: 'Vie quotidienne' },
] as const;

export const DOMAIN_CODES = DOMAINS.map((d) => d.code);

export const INTEREST_SUGGESTIONS = [
  'films',
  'musique',
  'sport',
  'jeux vidéo',
  'cuisine',
  'sciences',
  'philosophie',
  'actualités',
] as const;
