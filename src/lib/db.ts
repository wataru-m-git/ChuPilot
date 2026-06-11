'use server'
/**
 * データアクセス層 — Prisma (SQLite) 実装
 */

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import type {
  Mouse as PrismaMouseModel,
  Cage  as PrismaCageModel,
  Strain as PrismaStrainModel,
  Rack as PrismaRackModel,
  MatingRecord as PrismaMatingRecordModel,
} from '@prisma/client'
import type { Mouse, Cage, Strain, Rack, MatingRecord, DashboardSummary } from '@/types'

// ─── Input types ─────────────────────────────────────────────────────────────

export type MouseInput = Omit<
  Partial<Mouse>,
  'id' | 'cage_label' | 'weeks' | 'created_at' | 'updated_at'
>
export type CageInput   = Omit<Partial<Cage>,   'id' | 'mice' | 'rack' | 'created_at' | 'matingRecord'>
export type StrainInput = { name: string; description: string | null }

// ─── Mappers (Prisma model → App type) ───────────────────────────────────────

type PrismaMouseWithCage = PrismaMouseModel & { cage?: { cage_id: string } | null }
type PrismaCageWithMice  = PrismaCageModel  & { mice?: PrismaMouseModel[]; rack?: PrismaRackModel | null; matingRecord?: PrismaMatingRecordModel & { strain1?: PrismaStrainModel | null; strain2?: PrismaStrainModel | null } | null }

function toStrain(s: PrismaStrainModel): Strain {
  return {
    id:          s.id,
    name:        s.name,
    description: s.description,
    created_at:  s.created_at.toISOString(),
  }
}

function toRack(r: PrismaRackModel): Rack {
  return {
    id:         r.id,
    name:       r.name,
    slots:      r.slots,
    created_at: r.created_at.toISOString(),
  }
}

function toMatingRecord(m: PrismaMatingRecordModel & { strain1?: PrismaStrainModel | null; strain2?: PrismaStrainModel | null }): MatingRecord {
  return {
    id:           m.id,
    cage_id:      m.cage_id,
    strain1_id:   m.strain1_id,
    strain2_id:   m.strain2_id,
    mating_date:  m.mating_date ? m.mating_date.toISOString().split('T')[0] : null,
    birth_date:   m.birth_date ? m.birth_date.toISOString().split('T')[0] : null,
    wean_date:    m.wean_date ? m.wean_date.toISOString().split('T')[0] : null,
    notes:        m.notes,
    created_at:   m.created_at.toISOString(),
    strain1:      m.strain1 ? toStrain(m.strain1) : null,
    strain2:      m.strain2 ? toStrain(m.strain2) : null,
  }
}

function toMouse(m: PrismaMouseWithCage): Mouse {
  const today = Date.now()
  let genotypes: Record<string, string | null> = {}
  try {
    if (m.genotypes) genotypes = JSON.parse(m.genotypes as string) as Record<string, string | null>
  } catch { /* ignore */ }
  return {
    id:                     m.id,
    name:                   m.name,
    strain:                 m.strain,
    mother_id:              m.mother_id,
    father_id:              m.father_id,
    birth_day:              m.birth_day   ? m.birth_day.toISOString().split('T')[0]   : null,
    sex:                    m.sex,
    color:                  m.color,
    marking:                m.marking,
    cage_id:                m.cage_id,
    genotype_Ehf_cKO:       m.genotype_Ehf_cKO,
    genotype_CMV_Ehf_flox:  m.genotype_CMV_Ehf_flox,
    genotype_CMV_Elf3_flox: m.genotype_CMV_Elf3_flox,
    genotype_Ascl1CreERT2:  m.genotype_Ascl1CreERT2,
    genotype_Foxn1Cre:      m.genotype_Foxn1Cre,
    genotype_Fabp4Cre_RFP:  m.genotype_Fabp4Cre_RFP,
    genotype_Elf3Flox:      m.genotype_Elf3Flox,
    genotypes,
    typing_date:            m.typing_date ? m.typing_date.toISOString().split('T')[0] : null,
    status:                 m.status,
    notes:                  m.notes,
    created_at:             m.created_at.toISOString(),
    updated_at:             m.updated_at.toISOString(),
    cage_label:             m.cage?.cage_id ?? null,
    weeks:                  m.birth_day
                              ? parseFloat(((today - m.birth_day.getTime()) / (86400000 * 7)).toFixed(1))
                              : null,
  }
}

function toCage(c: PrismaCageWithMice): Cage {
  return {
    id:            c.id,
    cage_id:       c.cage_id,
    strain:        c.strain,
    rack_position: c.rack_position,
    rack_id:       c.rack_id,
    slot:          c.slot,
    capacity:      c.capacity,
    type:          c.type ?? 'normal',
    notes:         c.notes,
    created_at:    c.created_at.toISOString(),
    mice:          (c.mice ?? []).map((m) => toMouse(m as PrismaMouseWithCage)),
    rack:          c.rack ? toRack(c.rack) : null,
    matingRecord:  c.matingRecord ? toMatingRecord(c.matingRecord) : null,
  }
}

// ─── Mouse data preparation (string dates → Date) ────────────────────────────

function prepareMouseCreate(
  data: MouseInput,
  userId?: string,
): Prisma.MouseUncheckedCreateInput {
  return {
    name:                   data.name ?? '',
    strain:                 data.strain          ?? null,
    mother_id:              data.mother_id        ?? null,
    father_id:              data.father_id        ?? null,
    birth_day:              data.birth_day   ? new Date(data.birth_day)   : null,
    sex:                    data.sex              ?? null,
    color:                  data.color            ?? null,
    marking:                data.marking          ?? null,
    cage_id:                data.cage_id          ?? null,
    genotype_Ehf_cKO:       data.genotype_Ehf_cKO       ?? null,
    genotype_CMV_Ehf_flox:  data.genotype_CMV_Ehf_flox  ?? null,
    genotype_CMV_Elf3_flox: data.genotype_CMV_Elf3_flox ?? null,
    genotype_Ascl1CreERT2:  data.genotype_Ascl1CreERT2  ?? null,
    genotype_Foxn1Cre:      data.genotype_Foxn1Cre      ?? null,
    genotype_Fabp4Cre_RFP:  data.genotype_Fabp4Cre_RFP  ?? null,
    genotype_Elf3Flox:      data.genotype_Elf3Flox      ?? null,
    genotypes:              data.genotypes && Object.keys(data.genotypes).length > 0
                              ? JSON.stringify(data.genotypes) : null,
    typing_date:            data.typing_date ? new Date(data.typing_date) : null,
    status:                 data.status ?? 'active',
    notes:                  data.notes ?? null,
    created_by:             userId ?? null,
    updated_by:             userId ?? null,
  }
}

function prepareMouseUpdate(
  data: MouseInput,
  userId?: string,
): Prisma.MouseUncheckedUpdateInput {
  const result: Prisma.MouseUncheckedUpdateInput = { updated_by: userId ?? null }
  if (data.strain              !== undefined) result.strain              = data.strain
  if (data.mother_id           !== undefined) result.mother_id           = data.mother_id
  if (data.father_id           !== undefined) result.father_id           = data.father_id
  if (data.birth_day           !== undefined) result.birth_day           = data.birth_day   ? new Date(data.birth_day)   : null
  if (data.sex                 !== undefined) result.sex                 = data.sex
  if (data.color               !== undefined) result.color               = data.color
  if (data.marking             !== undefined) result.marking             = data.marking
  if (data.cage_id             !== undefined) result.cage_id             = data.cage_id
  if (data.genotype_Ehf_cKO    !== undefined) result.genotype_Ehf_cKO    = data.genotype_Ehf_cKO
  if (data.genotype_CMV_Ehf_flox  !== undefined) result.genotype_CMV_Ehf_flox  = data.genotype_CMV_Ehf_flox
  if (data.genotype_CMV_Elf3_flox !== undefined) result.genotype_CMV_Elf3_flox = data.genotype_CMV_Elf3_flox
  if (data.genotype_Ascl1CreERT2  !== undefined) result.genotype_Ascl1CreERT2  = data.genotype_Ascl1CreERT2
  if (data.genotype_Foxn1Cre      !== undefined) result.genotype_Foxn1Cre      = data.genotype_Foxn1Cre
  if (data.genotype_Fabp4Cre_RFP  !== undefined) result.genotype_Fabp4Cre_RFP  = data.genotype_Fabp4Cre_RFP
  if (data.genotype_Elf3Flox      !== undefined) result.genotype_Elf3Flox      = data.genotype_Elf3Flox
  if (data.genotypes !== undefined)
    result.genotypes = data.genotypes && Object.keys(data.genotypes).length > 0
      ? JSON.stringify(data.genotypes) : null
  if (data.typing_date         !== undefined) result.typing_date         = data.typing_date ? new Date(data.typing_date) : null
  if (data.status              !== undefined) result.status              = data.status
  if (data.notes               !== undefined) result.notes               = data.notes
  return result
}

// ─── Session helper ──────────────────────────────────────────────────────────

async function getUserId(): Promise<string | undefined> {
  try {
    const session = await auth()
    return session?.user?.id ?? undefined
  } catch {
    return undefined
  }
}

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('認証が必要です')
  }
  return session.user.id
}

// ─── Sort field validation ────────────────────────────────────────────────────

const VALID_MOUSE_SORT = new Set([
  'name', 'strain', 'sex', 'birth_day', 'status', 'typing_date',
  'created_at', 'updated_at', 'cage_id',
  'genotype_Ehf_cKO', 'genotype_CMV_Ehf_flox', 'genotype_CMV_Elf3_flox',
  'genotype_Ascl1CreERT2', 'genotype_Foxn1Cre', 'genotype_Fabp4Cre_RFP', 'genotype_Elf3Flox',
])

function resolveMouseSort(sort_by?: string): string {
  if (sort_by === 'weeks') return 'birth_day'
  return VALID_MOUSE_SORT.has(sort_by ?? '') ? sort_by! : 'name'
}

// ─── Mice ────────────────────────────────────────────────────────────────────

export async function getMice(
  filters: {
    search?:    string
    sex?:       string
    status?:    string
    strain?:    string
    cage_id?:   string
    sort_by?:   string
    sort_desc?: boolean
  } = {},
): Promise<Mouse[]> {
  await requireAuth()
  const where: Prisma.MouseWhereInput = {}
  if (filters.sex)     where.sex     = filters.sex
  if (filters.status)  where.status  = filters.status
  if (filters.strain)  where.strain  = filters.strain
  if (filters.cage_id) where.cage_id = Number(filters.cage_id)
  if (filters.search) {
    // SQLite の LIKE は ASCII で大文字小文字を区別しない
    where.OR = [
      { name:   { contains: filters.search } },
      { strain: { contains: filters.search } },
    ]
  }

  const sortField = resolveMouseSort(filters.sort_by)
  const orderBy = { [sortField]: filters.sort_desc ? 'desc' : 'asc' } as Prisma.MouseOrderByWithRelationInput

  const rows = await prisma.mouse.findMany({
    where,
    orderBy,
    include: { cage: { select: { cage_id: true } } },
  })
  return rows.map(toMouse)
}

export async function getMouse(id: number): Promise<Mouse | null> {
  await requireAuth()
  const m = await prisma.mouse.findUnique({
    where: { id },
    include: { cage: { select: { cage_id: true } } },
  })
  return m ? toMouse(m) : null
}

export async function createMouse(data: MouseInput, userId?: string): Promise<Mouse> {
  const uid = userId ?? await requireAuth()
  const m = await prisma.mouse.create({
    data: prepareMouseCreate(data, uid),
    include: { cage: { select: { cage_id: true } } },
  })
  return toMouse(m)
}

export async function updateMouse(id: number, data: MouseInput, userId?: string): Promise<Mouse> {
  const uid = userId ?? await requireAuth()
  const m = await prisma.mouse.update({
    where: { id },
    data: prepareMouseUpdate(data, uid),
    include: { cage: { select: { cage_id: true } } },
  })
  return toMouse(m)
}

export async function bulkCreateMice(
  payloads: MouseInput[],
  userId?: string,
): Promise<{ success: Mouse[]; errors: { index: number; error: string }[] }> {
  const uid = userId ?? await requireAuth()
  const success: Mouse[] = []
  const errors: { index: number; error: string }[] = []

  for (let i = 0; i < payloads.length; i++) {
    try {
      const m = await prisma.mouse.create({
        data: prepareMouseCreate(payloads[i], uid),
        include: { cage: { select: { cage_id: true } } },
      })
      success.push(toMouse(m))
    } catch (e) {
      console.error(`bulkCreateMice[${i}]:`, e)
      errors.push({ index: i, error: '登録に失敗しました' })
    }
  }
  return { success, errors }
}

export async function bulkUpdateMice(
  ids: number[],
  data: MouseInput,
  userId?: string,
): Promise<void> {
  const uid = userId ?? await requireAuth()

  // If genotypes need to be updated, merge with existing genotypes for each mouse
  if (data.genotypes !== undefined && Object.keys(data.genotypes).length > 0) {
    // Prepare update data without genotypes (we'll handle it separately)
    const dataWithoutGenotypes = { ...data }
    delete dataWithoutGenotypes.genotypes
    const updateData = prepareMouseUpdate(dataWithoutGenotypes, uid)

    for (const id of ids) {
      const existing = await prisma.mouse.findUnique({ where: { id }, select: { genotypes: true } })
      if (existing) {
        let merged: Record<string, string | null> = {}
        if (existing.genotypes) {
          try {
            merged = JSON.parse(existing.genotypes as string) as Record<string, string | null>
          } catch { /* ignore */ }
        }
        const newGenotypes = { ...merged, ...data.genotypes }
        await prisma.mouse.update({
          where: { id },
          data: {
            ...updateData,
            genotypes: JSON.stringify(newGenotypes),
          },
        })
      }
    }
  } else {
    // No genotypes update, use updateMany for efficiency
    await prisma.mouse.updateMany({
      where: { id: { in: ids } },
      data: prepareMouseUpdate(data, uid),
    })
  }
}

export async function deleteMouse(id: number): Promise<void> {
  await requireAuth()
  await prisma.mouse.delete({ where: { id } })
}

export async function bulkUpdateMiceMarkings(
  updates: { id: number; marking: string | null }[],
  userId?: string,
): Promise<void> {
  const uid = userId ?? await requireAuth()
  await prisma.$transaction(
    updates.map(({ id, marking }) =>
      prisma.mouse.update({
        where: { id },
        data: { marking, updated_by: uid ?? null },
      })
    )
  )
}

// ─── Cages ───────────────────────────────────────────────────────────────────

export async function getCages(): Promise<(Cage & { mice: Mouse[] })[]> {
  await requireAuth()
  const rows = await prisma.cage.findMany({
    orderBy: { cage_id: 'asc' },
    include: {
      mice: { where: { status: 'active' } },
      rack: true,
      matingRecord: { include: { strain1: true, strain2: true } }
    },
  })
  return rows.map((c) => toCage(c) as Cage & { mice: Mouse[] })
}

export async function getCage(id: number): Promise<(Cage & { mice: Mouse[] }) | null> {
  await requireAuth()
  const c = await prisma.cage.findUnique({
    where: { id },
    include: {
      mice: true,
      rack: true,
      matingRecord: { include: { strain1: true, strain2: true } }
    },
  })
  return c ? (toCage(c) as Cage & { mice: Mouse[] }) : null
}

export async function createCage(data: CageInput, userId?: string): Promise<Cage> {
  const uid = userId ?? await requireAuth()
  const { mice: _mice, ...rest } = data as CageInput & { mice?: unknown }
  const c = await prisma.cage.create({
    data: { ...rest, created_by: uid ?? null } as Prisma.CageUncheckedCreateInput,
  })
  return toCage({ ...c, mice: [] })
}

export async function updateCage(id: number, data: CageInput): Promise<Cage> {
  await requireAuth()
  const { mice: _mice, ...rest } = data as CageInput & { mice?: unknown }
  const c = await prisma.cage.update({
    where: { id },
    data: rest as Prisma.CageUncheckedUpdateInput,
    include: { mice: { where: { status: 'active' } } },
  })
  return toCage(c)
}

export async function deleteCage(id: number): Promise<void> {
  await requireAuth()
  const count = await prisma.mouse.count({ where: { cage_id: id } })
  if (count > 0)
    throw new Error('ケージ内にマウスが存在します。先に移動してください。')
  await prisma.cage.delete({ where: { id } })
}

export async function transferMouse(mouseId: number, newCageId: number): Promise<void> {
  await requireAuth()
  await prisma.mouse.update({
    where: { id: mouseId },
    data: { cage_id: newCageId },
  })
}

export async function releaseMouseFromCage(mouseId: number): Promise<void> {
  await requireAuth()
  await prisma.mouse.update({
    where: { id: mouseId },
    data: { cage_id: null },
  })
}

export async function getUncagedMice(): Promise<Mouse[]> {
  await requireAuth()
  const rows = await prisma.mouse.findMany({
    where: { cage_id: null, status: 'active' },
    orderBy: { name: 'asc' },
    include: { cage: { select: { cage_id: true } } },
  })
  return rows.map(toMouse)
}

/** 指定棚の次の空きアルファベットを返す (A → B → ... → Z → AA ...) */
export async function getNextCageLetter(rackPosition: string): Promise<string> {
  await requireAuth()
  const existing = await prisma.cage.findMany({
    where: { rack_position: rackPosition },
    select: { cage_id: true },
  })
  const usedLetters = new Set(
    existing.map((c) => {
      const parts = c.cage_id.split('-')
      const last = parts[parts.length - 1]
      return /^[A-Z]$/.test(last) ? last : ''
    }).filter(Boolean)
  )
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i)
    if (!usedLetters.has(letter)) return letter
  }
  return String.fromCharCode(65 + (existing.length % 26))
}

export async function updateCageRack(cageId: number, rackPosition: string | null): Promise<void> {
  await requireAuth()
  await prisma.cage.update({
    where: { id: cageId },
    data: { rack_position: rackPosition },
  })
}

/** @deprecated use transferMouse */
export const moveMouse = transferMouse

// ─── Racks ───────────────────────────────────────────────────────────────────

export async function getRacks(): Promise<Rack[]> {
  await requireAuth()
  const rows = await prisma.rack.findMany({
    orderBy: { name: 'asc' },
  })
  return rows.map(toRack)
}

export async function createRack(name: string, slots: number, userId?: string): Promise<Rack> {
  const uid = userId ?? await requireAuth()
  const r = await prisma.rack.create({
    data: {
      name,
      slots,
      created_by: uid ?? null,
    },
  })
  return toRack(r)
}

export async function updateRack(id: number, data: { slots?: number }): Promise<Rack> {
  await requireAuth()
  if (data.slots !== undefined) {
    const maxOccupied = await prisma.cage.aggregate({
      where: { rack_id: id, slot: { not: null } },
      _max: { slot: true },
    })
    if (maxOccupied._max.slot && maxOccupied._max.slot > data.slots) {
      const letter = String.fromCharCode(64 + maxOccupied._max.slot)
      throw new Error(`スロット${letter}にケージが存在するため、${data.slots}スロットに減らせません。`)
    }
  }
  const r = await prisma.rack.update({
    where: { id },
    data,
  })
  return toRack(r)
}

export async function deleteRack(id: number): Promise<void> {
  await requireAuth()
  const count = await prisma.cage.count({ where: { rack_id: id } })
  if (count > 0)
    throw new Error('棚内にケージが存在します。先に移動してください。')
  await prisma.rack.delete({ where: { id } })
}

export async function placeCageInSlot(
  cageId: number,
  rackId: number,
  slot: number,
): Promise<Cage> {
  await requireAuth()
  const rack = await prisma.rack.findUnique({ where: { id: rackId } })
  if (!rack) throw new Error('棚が見つかりません')
  if (slot < 1 || slot > rack.slots) throw new Error('無効なスロット位置です')

  // Check if slot is already occupied
  const occupant = await prisma.cage.findFirst({
    where: { rack_id: rackId, slot },
  })
  if (occupant && occupant.id !== cageId)
    throw new Error('このスロットは既に使用されています')

  // Generate new cage_id
  const slotLetter = String.fromCharCode(64 + slot)
  const newCageId = `${rack.name}-${slotLetter}`

  // Update cage
  const c = await prisma.cage.update({
    where: { id: cageId },
    data: {
      cage_id: newCageId,
      rack_id: rackId,
      slot,
      rack_position: rack.name,
    },
    include: {
      mice: { where: { status: 'active' } },
      rack: true,
      matingRecord: { include: { strain1: true, strain2: true } },
    },
  })
  return toCage(c)
}

// ─── Mating Records ──────────────────────────────────────────────────────────

export async function createMatingRecord(
  cageId: number,
  data: {
    strain1_id?: number | null
    strain2_id?: number | null
    mating_date?: string | null
    birth_date?: string | null
    wean_date?: string | null
    notes?: string | null
  },
): Promise<MatingRecord> {
  await requireAuth()
  const mr = await prisma.matingRecord.create({
    data: {
      cage_id: cageId,
      strain1_id: data.strain1_id ?? null,
      strain2_id: data.strain2_id ?? null,
      mating_date: data.mating_date ? new Date(data.mating_date) : null,
      birth_date: data.birth_date ? new Date(data.birth_date) : null,
      wean_date: data.wean_date ? new Date(data.wean_date) : null,
      notes: data.notes ?? null,
    },
    include: { strain1: true, strain2: true },
  })
  return toMatingRecord(mr)
}

export async function updateMatingRecord(
  id: number,
  data: {
    strain1_id?: number | null
    strain2_id?: number | null
    mating_date?: string | null
    birth_date?: string | null
    wean_date?: string | null
    notes?: string | null
  },
): Promise<MatingRecord> {
  await requireAuth()
  const updates: Record<string, unknown> = {}
  if (data.strain1_id !== undefined) updates.strain1_id = data.strain1_id
  if (data.strain2_id !== undefined) updates.strain2_id = data.strain2_id
  if (data.mating_date !== undefined) updates.mating_date = data.mating_date ? new Date(data.mating_date) : null
  if (data.birth_date !== undefined) updates.birth_date = data.birth_date ? new Date(data.birth_date) : null
  if (data.wean_date !== undefined) updates.wean_date = data.wean_date ? new Date(data.wean_date) : null
  if (data.notes !== undefined) updates.notes = data.notes

  const mr = await prisma.matingRecord.update({
    where: { id },
    data: updates as Prisma.MatingRecordUpdateInput,
    include: { strain1: true, strain2: true },
  })
  return toMatingRecord(mr)
}

export async function getMatingRecord(id: number): Promise<MatingRecord | null> {
  await requireAuth()
  const mr = await prisma.matingRecord.findUnique({
    where: { id },
    include: { strain1: true, strain2: true },
  })
  return mr ? toMatingRecord(mr) : null
}

// ─── Strains ─────────────────────────────────────────────────────────────────

export async function getStrains(): Promise<Strain[]> {
  await requireAuth()
  const rows = await prisma.strain.findMany({ orderBy: { name: 'asc' } })
  return rows.map(toStrain)
}

export async function createStrain(data: StrainInput, userId?: string): Promise<Strain> {
  const uid = userId ?? await requireAuth()
  const s = await prisma.strain.create({
    data: { ...data, created_by: uid ?? null },
  })
  return toStrain(s)
}

export async function updateStrain(id: number, data: StrainInput): Promise<Strain> {
  await requireAuth()
  const s = await prisma.strain.update({ where: { id }, data })
  return toStrain(s)
}

export async function deleteStrain(id: number): Promise<void> {
  await requireAuth()
  await prisma.strain.delete({ where: { id } })
}

export async function bulkCreateStrains(
  names: string[],
  userId?: string,
): Promise<{ created: Strain[]; skipped: string[] }> {
  const uid = userId ?? await requireAuth()
  const created: Strain[] = []
  const skipped: string[] = []

  // 既存の重複を一括チェック
  const existing = await prisma.strain.findMany({
    where: { name: { in: names } },
    select: { name: true },
  })
  const existingSet = new Set(existing.map((s) => s.name))

  for (const name of names) {
    if (existingSet.has(name)) {
      skipped.push(name)
      continue
    }
    try {
      const s = await prisma.strain.create({
        data: { name, created_by: uid ?? null },
      })
      created.push(toStrain(s))
      existingSet.add(name) // 入力リスト内の重複も対処
    } catch {
      skipped.push(name) // 競合によるユニーク制約違反
    }
  }
  return { created, skipped }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<{
  totalActive: number
  totalCages: number
  maleCount: number
  femaleCount: number
  byStrain: { strain: string; count: number }[]
}> {
  await requireAuth()
  const [activeMice, totalCages] = await Promise.all([
    prisma.mouse.findMany({
      where: { status: 'active' },
      select: { sex: true, strain: true },
    }),
    prisma.cage.count(),
  ])

  let maleCount = 0, femaleCount = 0
  const strainMap: Record<string, number> = {}
  for (const m of activeMice) {
    if (m.sex === '♂') maleCount++
    if (m.sex === '♀') femaleCount++
    const s = m.strain || '不明'
    strainMap[s] = (strainMap[s] || 0) + 1
  }

  return {
    totalActive: activeMice.length,
    totalCages,
    maleCount,
    femaleCount,
    byStrain: Object.entries(strainMap)
      .map(([strain, count]) => ({ strain, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/** @deprecated use getDashboardSummary — 既存ページとの後方互換エイリアス */
export async function getDashboard(): Promise<DashboardSummary> {
  const s = await getDashboardSummary()
  return {
    total_mice:   s.totalActive,
    total_cages:  s.totalCages,
    male_count:   s.maleCount,
    female_count: s.femaleCount,
    by_strain:    s.byStrain,
  }
}
