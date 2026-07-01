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

export function buildGenotypeString(mouse: Mouse): string {
  if (mouse.genotypes && Object.keys(mouse.genotypes).length > 0) {
    return Object.entries(mouse.genotypes)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' / ');
  }
  return '-';
}

export function calcWeeks(birthDay: string | null): string {
  if (!birthDay) return '-';
  const days = (Date.now() - new Date(birthDay).getTime()) / 86400000;
  return `${(days / 7).toFixed(1)}w`;
}
