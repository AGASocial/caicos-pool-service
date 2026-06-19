/** Visit form config aligned with WhatsApp route workflows (RUTA 1, 3, 4, 7, 24). */

export type IssueCategoryKey =
  | 'motor'
  | 'filter'
  | 'circulation'
  | 'timer'
  | 'chemistry'
  | 'other';

export const ISSUE_CATEGORY_OPTIONS: { key: IssueCategoryKey; label: string }[] = [
  { key: 'motor', label: 'Motor' },
  { key: 'filter', label: 'Filter' },
  { key: 'circulation', label: 'Circulation' },
  { key: 'timer', label: 'Timer' },
  { key: 'chemistry', label: 'Chemistry' },
  { key: 'other', label: 'Other' },
];

/** Optional visit extras — only toggled when something beyond standard service happened. */
export const VISIT_EXTRAS: {
  key: string;
  label: string;
  reportField?: 'cleaned_filter' | 'vacuumed';
  promptsFollowUp?: boolean;
  promptsChemicalNote?: boolean;
}[] = [
  {
    key: 'cleaned_filter',
    label: 'Filter serviced',
    reportField: 'cleaned_filter',
  },
  {
    key: 'vacuumed',
    label: 'Extra vacuum',
    reportField: 'vacuumed',
  },
  {
    key: 'low_water',
    label: 'Low water',
    promptsFollowUp: true,
  },
  {
    key: 'salt_chemicals',
    label: 'Salt / chemicals added',
    promptsChemicalNote: true,
  },
];

export const CHEMICAL_READINGS = [
  { key: 'ph_level', label: 'pH', ideal: '7.2-7.6', unit: 'pH' },
  { key: 'chlorine_level', label: 'Chlorine', ideal: '1-3', unit: 'ppm' },
  { key: 'alkalinity', label: 'Alkalinity', ideal: '80-120', unit: 'ppm' },
  { key: 'calcium_hardness', label: 'Calcium Hardness', ideal: '200-400', unit: 'ppm' },
  { key: 'cyanuric_acid', label: 'CYA', ideal: '30-100', unit: 'ppm' },
  { key: 'salt_level', label: 'Salt', ideal: '2700-3400', unit: 'ppm' },
  { key: 'water_temp_f', label: 'Water Temp', ideal: '78-86', unit: '\u00b0F' },
] as const;

export const EQUIPMENT = [
  { key: 'pump_ok', label: 'Pump' },
  { key: 'filter_ok', label: 'Filter' },
  { key: 'heater_ok', label: 'Heater' },
  { key: 'cleaner_ok', label: 'Cleaner' },
] as const;
