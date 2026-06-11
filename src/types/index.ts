export interface Strain {
  id: number;
  name: string;
  description: string | null;
  created_at: string | null;
}

export interface Rack {
  id: number;
  name: string;
  slots: number;
  created_at: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
}

export interface Mouse {
  id: number;
  name: string;
  strain: string | null;
  mother_id: string | null;
  father_id: string | null;
  birth_day: string | null;
  sex: string | null;
  color: string | null;
  marking: string | null;
  cage_id: number | null;
  cage_label?: string | null;
  weeks?: number | null;
  // Legacy fixed genotype columns (kept for backward compat display)
  genotype_Ehf_cKO: string | null;
  genotype_CMV_Ehf_flox: string | null;
  genotype_CMV_Elf3_flox: string | null;
  genotype_Ascl1CreERT2: string | null;
  genotype_Foxn1Cre: string | null;
  genotype_Fabp4Cre_RFP: string | null;
  genotype_Elf3Flox: string | null;
  // New dynamic genotype storage (JSON column)
  genotypes: Record<string, string | null>;
  typing_date: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MatingRecord {
  id: number;
  cage_id: number;
  strain1_id: number | null;
  strain2_id: number | null;
  mating_date: string | null;
  birth_date: string | null;
  wean_date: string | null;
  notes: string | null;
  created_at: string | null;
  strain1?: Strain | null;
  strain2?: Strain | null;
}

export interface Cage {
  id: number;
  cage_id: string;
  strain: string | null;
  rack_position: string | null;
  rack_id: number | null;
  slot: number | null;
  capacity: number;
  type?: string;
  notes: string | null;
  created_at: string | null;
  mice: Mouse[];
  rack?: Rack | null;
  matingRecord?: MatingRecord | null;
}

export interface DashboardSummary {
  total_mice: number;
  total_cages: number;
  male_count: number;
  female_count: number;
  by_strain: { strain: string; count: number }[];
}

/** 系統名を ';' で分割して遺伝子型名リストを返す */
export function getGenotypeNamesFromStrain(strainName: string | null | undefined): string[] {
  if (!strainName) return [];
  return strainName.split(';').map((s) => s.trim()).filter(Boolean);
}

export const GENOTYPE_OPTIONS = ['hetero', 'homo', 'null'] as const;

// Legacy fields — still used when displaying older mice that have no genotypes JSON
export const GENOTYPE_FIELDS: { key: keyof Mouse; label: string; displayLabel: string }[] = [
  { key: 'genotype_Ehf_cKO', label: 'Ehf_cKO', displayLabel: 'Ehf_cKO' },
  { key: 'genotype_CMV_Ehf_flox', label: 'CMV_Ehf_flox', displayLabel: 'CMV_Ehf_flox' },
  { key: 'genotype_CMV_Elf3_flox', label: 'CMV_Elf3_flox', displayLabel: 'CMV_Elf3#8_flox' },
  { key: 'genotype_Ascl1CreERT2', label: 'Ascl1CreERT2', displayLabel: 'Ascl1CreERT2' },
  { key: 'genotype_Foxn1Cre', label: 'Foxn1Cre', displayLabel: 'Foxn1Cre' },
  { key: 'genotype_Fabp4Cre_RFP', label: 'Fabp4Cre_RFP', displayLabel: 'Fabp4Cre<RFP>' },
  { key: 'genotype_Elf3Flox', label: 'Elf3Flox', displayLabel: 'Elf3Flox' },
];

/** @deprecated Use getGenotypeNamesFromStrain instead */
export function getGenotypeFieldsForStrain(strain: string | null | undefined) {
  if (!strain) return GENOTYPE_FIELDS;
  const parts = strain.split(':').map((p) => p.trim()).filter(Boolean);
  const matched = parts
    .map((part) => GENOTYPE_FIELDS.find((f) => f.label === part))
    .filter((f): f is (typeof GENOTYPE_FIELDS)[0] => f !== undefined);
  return matched.length > 0 ? matched : GENOTYPE_FIELDS;
}

export function buildGenotypeString(mouse: Mouse): string {
  // Use new dynamic genotypes if available
  if (mouse.genotypes && Object.keys(mouse.genotypes).length > 0) {
    return Object.entries(mouse.genotypes)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' / ');
  }
  // Fall back to legacy fixed fields
  return GENOTYPE_FIELDS
    .filter((f) => mouse[f.key])
    .map((f) => `${f.label}: ${mouse[f.key]}`)
    .join(' / ');
}

export function calcWeeks(birthDay: string | null): string {
  if (!birthDay) return '-';
  const days = (Date.now() - new Date(birthDay).getTime()) / 86400000;
  return `${(days / 7).toFixed(1)}w`;
}
