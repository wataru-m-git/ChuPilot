'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  getCages, transferMouse, releaseMouseFromCage, getUncagedMice,
  createCage, updateCage, deleteCage, getStrains,
  getNextCageLetter, updateCageRack, createMatingRecord, updateMatingRecord,
  getRacks, createRack, placeCageInSlot, deleteRack, updateRack,
} from '@/lib/db'
import type { Cage, Mouse, Strain, Rack } from '@/types'
import CageCard, { DraggableMouse } from '@/components/CageCard'

interface EditingCage {
  id?: number
  cage_id: string
  strain: string
  type: 'normal' | 'mating'
  strain1_id?: number | null
  strain2_id?: number | null
  rack_position: string
  rack_id?: number | null
  slot?: number | null
  capacity: number
  notes: string
}

export default function CagesPage() {
  const [cages, setCages] = useState<Cage[]>([])
  const [racks, setRacks] = useState<Rack[]>([])
  const [uncagedMice, setUncagedMice] = useState<Mouse[]>([])
  const [strains, setStrains] = useState<Strain[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMouse, setActiveMouse] = useState<Mouse | null>(null)
  const [activeCage, setActiveCage] = useState<Cage | null>(null)
  const [isDraggingCage, setIsDraggingCage] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingCage, setEditingCage] = useState<EditingCage | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showRackModal, setShowRackModal] = useState(false)
  const [newRackName, setNewRackName] = useState('')
  const [newRackSlots, setNewRackSlots] = useState(6)
  const [showEditRackModal, setShowEditRackModal] = useState(false)
  const [editingRack, setEditingRack] = useState<Rack | null>(null)
  const [editRackSlots, setEditRackSlots] = useState(6)
  const [selectedCageForMating, setSelectedCageForMating] = useState<Cage | null>(null)
  const [matingTab, setMatingTab] = useState<'mating_date' | 'birth_date' | 'wean_date'>('mating_date')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const fetchCages = useCallback(async () => {
    const data = await getCages()
    setCages(data)
  }, [])

  const fetchUncagedMice = useCallback(async () => {
    const data = await getUncagedMice()
    setUncagedMice(data)
  }, [])

  const fetchRacks = useCallback(async () => {
    const data = await getRacks()
    setRacks(data)
  }, [])

  useEffect(() => {
    Promise.all([fetchCages(), fetchUncagedMice(), fetchRacks(), getStrains().then(setStrains)]).then(() =>
      setLoading(false)
    )
  }, [fetchCages, fetchUncagedMice, fetchRacks])

  const handleDragStart = (event: DragStartEvent) => {
    const { data } = event.active
    if (data.current?.type === 'cage') {
      setIsDraggingCage(true)
      setActiveCage(cages.find((c) => c.id === data.current?.cageDbId) ?? null)
    } else if (data.current?.type === 'mouse') {
      setIsDraggingCage(false)
      const mouseId = data.current.mouseId as number
      for (const cage of cages) {
        const m = cage.mice.find((m) => m.id === mouseId)
        if (m) { setActiveMouse(m); return }
      }
      const m = uncagedMice.find((m) => m.id === mouseId)
      if (m) setActiveMouse(m)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveMouse(null)
    setActiveCage(null)
    setIsDraggingCage(false)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    // ── Cage → Slot DnD ───────────────────────────────────────────────────────
    if (activeData?.type === 'cage' && overData?.type === 'slot') {
      const cageDbId = activeData.cageDbId as number
      const targetRackId = overData.rackId as number
      const targetSlot = overData.slot as number
      try {
        await placeCageInSlot(cageDbId, targetRackId, targetSlot)
        fetchCages()
      } catch (e) {
        console.error(e)
        setError((e as Error).message || 'ケージの移動に失敗しました')
        fetchCages()
      }
      return
    }

    // ── Cage → Rack DnD (legacy) ───────────────────────────────────────────────────────
    if (activeData?.type === 'cage' && overData?.type === 'rack') {
      const cageDbId = activeData.cageDbId as number
      const targetRack = overData.rackName as string
      const sourceCage = cages.find((c) => c.id === cageDbId)
      if (!sourceCage || sourceCage.rack_position === targetRack) return

      setCages((prev) =>
        prev.map((c) => c.id === cageDbId ? { ...c, rack_position: targetRack } : c)
      )
      try {
        await updateCageRack(cageDbId, targetRack)
        fetchCages()
      } catch (e) { console.error(e); fetchCages() }
      return
    }

    // ── Mouse DnD ─────────────────────────────────────────────────────────────
    if (activeData?.type !== 'mouse') return

    const mouseId = activeData.mouseId as number
    const sourceCageId = activeData.sourceCageId as number | null

    if (overData?.type === 'cage') {
      const targetCageId = overData.cageId as number
      if (sourceCageId === targetCageId) return

      if (sourceCageId === null) {
        const mouse = uncagedMice.find((m) => m.id === mouseId)
        if (!mouse) return
        setUncagedMice((prev) => prev.filter((m) => m.id !== mouseId))
        setCages((prev) => prev.map((cage) =>
          cage.id === targetCageId
            ? { ...cage, mice: [...cage.mice, { ...mouse, cage_id: targetCageId }] }
            : cage
        ))
        try { await transferMouse(mouseId, targetCageId); fetchCages(); fetchUncagedMice() }
        catch (e) { console.error(e); fetchCages(); fetchUncagedMice() }
      } else {
        setCages((prev) => prev.map((cage) => {
          if (cage.id === sourceCageId) return { ...cage, mice: cage.mice.filter((m) => m.id !== mouseId) }
          if (cage.id === targetCageId) {
            const mouse = prev.find((c) => c.id === sourceCageId)?.mice.find((m) => m.id === mouseId)
            if (mouse) return { ...cage, mice: [...cage.mice, { ...mouse, cage_id: targetCageId }] }
          }
          return cage
        }))
        try { await transferMouse(mouseId, targetCageId); fetchCages() }
        catch (e) { console.error(e); fetchCages() }
      }
    } else if (overData?.type === 'nocage') {
      if (sourceCageId === null) return
      const mouse = cages.find((c) => c.id === sourceCageId)?.mice.find((m) => m.id === mouseId)
      if (!mouse) return
      setCages((prev) => prev.map((cage) =>
        cage.id === sourceCageId ? { ...cage, mice: cage.mice.filter((m) => m.id !== mouseId) } : cage
      ))
      setUncagedMice((prev) => [...prev, { ...mouse, cage_id: null, cage_label: null }])
      try { await releaseMouseFromCage(mouseId); fetchCages(); fetchUncagedMice() }
      catch (e) { console.error(e); fetchCages(); fetchUncagedMice() }
    }
  }

  const openNewCage = async (rackPosition?: string) => {
    let cageId = ''
    if (rackPosition) {
      const letter = await getNextCageLetter(rackPosition)
      cageId = `${rackPosition}-${letter}`
    }
    setEditingCage({ cage_id: cageId, strain: '', type: 'normal', rack_position: rackPosition ?? '', capacity: 5, notes: '' })
    setError('')
    setShowModal(true)
  }

  const openEditCage = (cage: Cage) => {
    setEditingCage({
      id: cage.id,
      cage_id: cage.cage_id,
      strain: cage.strain || '',
      type: (cage.type as 'normal' | 'mating') || 'normal',
      strain1_id: cage.matingRecord?.strain1_id ?? undefined,
      strain2_id: cage.matingRecord?.strain2_id ?? undefined,
      rack_position: cage.rack_position || '',
      rack_id: cage.rack_id ?? undefined,
      slot: cage.slot ?? undefined,
      capacity: cage.capacity,
      notes: cage.notes || '',
    })
    setError('')
    setShowModal(true)
    setSelectedCageForMating(cage.type === 'mating' ? cage : null)
  }

  const openNewCageInSlot = (rackId: number, slot: number) => {
    const rack = racks.find((r) => r.id === rackId)
    if (!rack) return
    const slotLetter = String.fromCharCode(64 + slot)
    const cageId = `${rack.name}-${slotLetter}`
    setEditingCage({
      cage_id: cageId,
      strain: '',
      type: 'normal',
      rack_position: rack.name,
      rack_id: rackId,
      slot,
      capacity: 5,
      notes: '',
    })
    setError('')
    setShowModal(true)
  }

  const handleRackPositionChange = async (newRack: string) => {
    setEditingCage((prev) => prev ? { ...prev, rack_position: newRack } : null)
    if (newRack && !editingCage?.id) {
      const letter = await getNextCageLetter(newRack)
      setEditingCage((prev) => prev ? { ...prev, rack_position: newRack, cage_id: `${newRack}-${letter}` } : null)
    }
  }

  const handleDeleteCage = async () => {
    if (!editingCage?.id) return
    if (!confirm(`ケージ「${editingCage.cage_id}」を削除しますか？`)) return
    setSaving(true)
    setError('')
    try {
      await deleteCage(editingCage.id)
      setShowModal(false)
      fetchCages()
    } catch (e: unknown) {
      setError((e as Error).message || '削除に失敗しました')
    } finally { setSaving(false) }
  }

  const handleSaveCage = async () => {
    if (!editingCage) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        cage_id: editingCage.cage_id,
        strain: editingCage.strain || null,
        type: editingCage.type,
        rack_position: editingCage.rack_position || null,
        capacity: editingCage.capacity,
        notes: editingCage.notes || null,
      }
      let newCageId: number | undefined
      if (editingCage.id) {
        await updateCage(editingCage.id, payload)
        newCageId = editingCage.id
      } else {
        const newCage = await createCage(payload)
        newCageId = newCage.id
      }

      if (editingCage.type === 'mating' && newCageId) {
        if (editingCage.id && selectedCageForMating?.matingRecord) {
          await updateMatingRecord(selectedCageForMating.matingRecord.id, {
            strain1_id: editingCage.strain1_id ?? null,
            strain2_id: editingCage.strain2_id ?? null,
          })
        } else {
          await createMatingRecord(newCageId, {
            strain1_id: editingCage.strain1_id ?? null,
            strain2_id: editingCage.strain2_id ?? null,
          })
        }
      }
      setShowModal(false)
      setSelectedCageForMating(null)
      fetchCages()
    } catch (e: unknown) {
      setError((e as Error).message || '保存に失敗しました')
    } finally { setSaving(false) }
  }

  const handleSaveMatingDate = async (fieldName: 'mating_date' | 'birth_date' | 'wean_date', value: string) => {
    if (!selectedCageForMating?.matingRecord) return
    setSaving(true)
    setError('')
    try {
      await updateMatingRecord(selectedCageForMating.matingRecord.id, {
        [fieldName]: value ? value : null,
      })
      fetchCages()
      const updatedCage = (await getCages()).find((c) => c.id === selectedCageForMating.id)
      if (updatedCage) setSelectedCageForMating(updatedCage)
    } catch (e: unknown) {
      setError((e as Error).message || '保存に失敗しました')
    } finally { setSaving(false) }
  }

  const handleCreateRack = async () => {
    const name = newRackName.trim()
    if (!name) return
    setSaving(true)
    setError('')
    try {
      await createRack(name, newRackSlots)
      setShowRackModal(false)
      setNewRackName('')
      setNewRackSlots(6)
      fetchRacks()
    } catch (e) {
      setError((e as Error).message || '棚の作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenEditRack = (rack: Rack) => {
    setEditingRack(rack)
    setEditRackSlots(rack.slots)
    setError('')
    setShowEditRackModal(true)
  }

  const handleUpdateRack = async () => {
    if (!editingRack) return
    setSaving(true)
    setError('')
    try {
      await updateRack(editingRack.id, { slots: editRackSlots })
      setShowEditRackModal(false)
      setEditingRack(null)
      fetchRacks()
    } catch (e) {
      setError((e as Error).message || 'スロット数の変更に失敗しました')
    } finally { setSaving(false) }
  }

  const handleDeleteRack = async () => {
    if (!editingRack) return
    if (!confirm(`棚「${editingRack.name}」を削除しますか？`)) return
    setSaving(true)
    setError('')
    try {
      await deleteRack(editingRack.id)
      setShowEditRackModal(false)
      setEditingRack(null)
      fetchRacks()
    } catch (e) {
      setError((e as Error).message || '削除に失敗しました')
    } finally { setSaving(false) }
  }

  // Build rackSlotMap for new Rack system
  const rackSlotMap: Record<number, (Cage | null)[]> = {}
  for (const rack of racks) {
    const slots = Array<Cage | null>(rack.slots).fill(null)
    for (const cage of cages) {
      if (cage.rack_id === rack.id && cage.slot != null) {
        slots[cage.slot - 1] = cage
      }
    }
    rackSlotMap[rack.id] = slots
  }

  // Legacy racks (cages without rack_id, grouped by rack_position)
  const legacyRackGroups = cages.reduce<Record<string, Cage[]>>((acc, cage) => {
    if (cage.rack_id) return acc
    const rackName = cage.rack_position || '未配置'
    if (!acc[rackName]) acc[rackName] = []
    acc[rackName].push(cage)
    return acc
  }, {})

  if (loading) return <div style={{ padding: '2rem' }}>読み込み中...</div>

  return (
    <div style={styles.container}>
      <style>{`
        @media print {
          aside { display: none !important; }
          .print-hide { display: none !important; }
          main { overflow: visible !important; }
          [data-dnd-draggable], [data-dnd-droppable] {
            transform: none !important;
            opacity: 1 !important;
            cursor: default !important;
          }
          .cage-slot-grid {
            grid-template-columns: repeat(auto-fill, minmax(130px, 160px)) !important;
          }
          .rack-section { break-inside: avoid; page-break-inside: avoid; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div style={styles.header}>
        <h2 style={styles.title}>ケージビュー</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="print-hide" style={styles.printBtn} onClick={() => window.print()}>PDF出力</button>
          <button className="print-hide" style={styles.addRackBtn} onClick={() => { setNewRackName(''); setNewRackSlots(6); setShowRackModal(true) }}>+ 新規棚</button>
          <button className="print-hide" style={styles.addBtn} onClick={() => openNewCage()}>+ 新規ケージ</button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* New Rack slot grid system */}
        {racks.map((rack) => (
          <SlotGrid
            key={rack.id}
            rack={rack}
            slots={rackSlotMap[rack.id] || []}
            isDraggingCage={isDraggingCage}
            onAddCage={openNewCageInSlot}
            onEditCage={openEditCage}
            onEditRack={handleOpenEditRack}
          />
        ))}

        {/* Legacy racks (fallback for cages without rack_id) */}
        {Object.entries(legacyRackGroups).map(([rackName, rackCages]) => (
          <div key={`legacy-${rackName}`} style={styles.rackSection}>
            <h3 style={styles.rackLabel}>棚: {rackName}</h3>
            <RackDropZone rackName={rackName} isDraggingCage={isDraggingCage}>
              <div style={styles.cageGrid}>
                {rackCages.map((cage) => (
                  <CageCard key={cage.id} cage={cage} onEdit={openEditCage} />
                ))}
              </div>
            </RackDropZone>
          </div>
        ))}

        {cages.length === 0 && uncagedMice.length === 0 && (
          <div style={styles.empty}>
            <p>ケージがありません。「新規ケージ」ボタンで追加してください。</p>
          </div>
        )}

        <NonCageSection mice={uncagedMice} />

        <DragOverlay>
          {activeMouse && (
            <div style={styles.dragOverlay}>
              <strong>{activeMouse.name}</strong>
              <span style={{ marginLeft: '0.5rem', color: '#718096' }}>
                {activeMouse.sex}{activeMouse.marking} {activeMouse.weeks != null ? `${activeMouse.weeks}w` : ''}
              </span>
            </div>
          )}
          {activeCage && (
            <div style={{ ...styles.dragOverlay, background: '#fefcbf', borderColor: '#d69e2e' }}>
              <strong>{activeCage.cage_id}</strong>
              <span style={{ marginLeft: '0.5rem', color: '#718096', fontSize: '0.78rem' }}>
                {activeCage.mice.length}匹
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Cage Edit Modal */}
      {showModal && editingCage && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ marginBottom: '1rem' }}>
              {editingCage.id ? 'ケージ編集' : '新規ケージ作成'}
            </h3>
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="radio"
                  name="cage_type"
                  value="normal"
                  checked={editingCage.type === 'normal'}
                  onChange={() => setEditingCage({ ...editingCage, type: 'normal' })}
                />
                <span>通常ケージ</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="radio"
                  name="cage_type"
                  value="mating"
                  checked={editingCage.type === 'mating'}
                  onChange={() => setEditingCage({ ...editingCage, type: 'mating' })}
                />
                <span>交配ケージ</span>
              </label>
            </div>
            <div style={styles.formGrid}>
              <div style={styles.formField}>
                <label style={styles.formLabel}>ケージID {editingCage.id ? '（変更不可）' : '*'}</label>
                <input
                  style={{ ...styles.formInput, ...(editingCage.id ? { background: '#f7fafc', color: '#718096' } : {}) }}
                  value={editingCage.cage_id}
                  readOnly={!!editingCage.id}
                  onChange={(e) => !editingCage.id && setEditingCage({ ...editingCage, cage_id: e.target.value })}
                  placeholder="棚名を入力すると自動設定"
                />
              </div>
              {editingCage.type === 'normal' && (
                <div style={styles.formField}>
                  <label style={styles.formLabel}>系統名</label>
                  <select style={styles.formInput} value={editingCage.strain}
                    onChange={(e) => setEditingCage({ ...editingCage, strain: e.target.value })}>
                    <option value="">選択してください</option>
                    {strains.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    {editingCage.strain && !strains.find((s) => s.name === editingCage.strain) && (
                      <option value={editingCage.strain}>{editingCage.strain}（未登録）</option>
                    )}
                  </select>
                </div>
              )}
              {editingCage.type === 'mating' && (
                <>
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>系統1（母方）</label>
                    <select style={styles.formInput} value={editingCage.strain1_id ?? ''}
                      onChange={(e) => setEditingCage({ ...editingCage, strain1_id: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">選択してください</option>
                      {strains.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>系統2（父方）</label>
                    <select style={styles.formInput} value={editingCage.strain2_id ?? ''}
                      onChange={(e) => setEditingCage({ ...editingCage, strain2_id: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">選択してください</option>
                      {strains.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div style={styles.formField}>
                <label style={styles.formLabel}>棚位置</label>
                <input style={styles.formInput} value={editingCage.rack_position}
                  onChange={(e) => handleRackPositionChange(e.target.value)}
                  placeholder="例: 9-2-A" />
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel}>収容可能数</label>
                <input type="number" style={styles.formInput} value={editingCage.capacity}
                  onChange={(e) => setEditingCage({ ...editingCage, capacity: Number(e.target.value) })}
                  min={1} max={20} />
              </div>
              <div style={{ ...styles.formField, gridColumn: '1 / -1' }}>
                <label style={styles.formLabel}>メモ</label>
                <input style={styles.formInput} value={editingCage.notes}
                  onChange={(e) => setEditingCage({ ...editingCage, notes: e.target.value })} />
              </div>
            </div>
            {editingCage.type === 'mating' && editingCage.id && selectedCageForMating?.matingRecord && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', color: '#2d3748' }}>交配記録</h4>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                  <button
                    style={{
                      padding: '0.5rem 1rem',
                      background: matingTab === 'mating_date' ? '#4299e1' : '#e2e8f0',
                      color: matingTab === 'mating_date' ? '#fff' : '#4a5568',
                      border: 'none',
                      borderRadius: '4px 4px 0 0',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                    onClick={() => setMatingTab('mating_date')}
                  >
                    交配日
                  </button>
                  <button
                    style={{
                      padding: '0.5rem 1rem',
                      background: matingTab === 'birth_date' ? '#4299e1' : '#e2e8f0',
                      color: matingTab === 'birth_date' ? '#fff' : '#4a5568',
                      border: 'none',
                      borderRadius: '4px 4px 0 0',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                    onClick={() => setMatingTab('birth_date')}
                  >
                    出産日
                  </button>
                  <button
                    style={{
                      padding: '0.5rem 1rem',
                      background: matingTab === 'wean_date' ? '#4299e1' : '#e2e8f0',
                      color: matingTab === 'wean_date' ? '#fff' : '#4a5568',
                      border: 'none',
                      borderRadius: '4px 4px 0 0',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                    onClick={() => setMatingTab('wean_date')}
                  >
                    離乳日
                  </button>
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0 4px 4px 4px', padding: '1rem' }}>
                  {matingTab === 'mating_date' && (
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>交配日</label>
                      <input
                        type="date"
                        style={styles.formInput}
                        value={selectedCageForMating.matingRecord.mating_date ?? ''}
                        onChange={(e) => handleSaveMatingDate('mating_date', e.target.value)}
                      />
                    </div>
                  )}
                  {matingTab === 'birth_date' && (
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>出産日</label>
                      <input
                        type="date"
                        style={styles.formInput}
                        value={selectedCageForMating.matingRecord.birth_date ?? ''}
                        onChange={(e) => handleSaveMatingDate('birth_date', e.target.value)}
                      />
                    </div>
                  )}
                  {matingTab === 'wean_date' && (
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>離乳日</label>
                      <input
                        type="date"
                        style={styles.formInput}
                        value={selectedCageForMating.matingRecord.wean_date ?? ''}
                        onChange={(e) => handleSaveMatingDate('wean_date', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            {error && <p style={{ color: '#e53e3e', fontSize: '0.85rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              {editingCage.id && (
                <button style={styles.deleteBtn} onClick={handleDeleteCage} disabled={saving}>削除</button>
              )}
              <button style={styles.cancelBtn} onClick={() => setShowModal(false)}>キャンセル</button>
              <button style={styles.saveBtn} onClick={handleSaveCage} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Rack Modal */}
      {showRackModal && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: '360px' }}>
            <h3 style={{ marginBottom: '1rem' }}>新規棚を追加</h3>
            <div style={styles.formField}>
              <label style={styles.formLabel}>棚名 *</label>
              <input
                style={styles.formInput}
                value={newRackName}
                onChange={(e) => setNewRackName(e.target.value)}
                placeholder="例: R3-1"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRack() }}
                autoFocus
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel}>スロット数 (1-26)</label>
              <input
                type="number"
                style={styles.formInput}
                value={newRackSlots}
                onChange={(e) => setNewRackSlots(Math.max(1, Math.min(26, Number(e.target.value))))}
                min={1}
                max={26}
              />
              <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem' }}>
                A〜{String.fromCharCode(64 + newRackSlots)} のスロットが作成されます
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button style={styles.cancelBtn} onClick={() => setShowRackModal(false)}>キャンセル</button>
              <button style={styles.saveBtn} onClick={handleCreateRack} disabled={!newRackName.trim() || saving}>
                {saving ? '作成中...' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rack Modal */}
      {showEditRackModal && editingRack && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: '360px' }}>
            <h3 style={{ marginBottom: '1rem' }}>棚を編集: {editingRack.name}</h3>
            <div style={styles.formField}>
              <label style={styles.formLabel}>スロット数 (1-26)</label>
              <input
                type="number"
                style={styles.formInput}
                value={editRackSlots}
                onChange={(e) => setEditRackSlots(Math.max(1, Math.min(26, Number(e.target.value))))}
                min={1}
                max={26}
                autoFocus
              />
              <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem' }}>
                A〜{String.fromCharCode(64 + editRackSlots)} のスロットが作成されます
              </p>
            </div>
            {error && <p style={{ color: '#e53e3e', fontSize: '0.85rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button style={styles.deleteBtn} onClick={handleDeleteRack} disabled={saving}>削除</button>
              <button style={styles.cancelBtn} onClick={() => { setShowEditRackModal(false); setError('') }}>キャンセル</button>
              <button style={styles.saveBtn} onClick={handleUpdateRack} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SlotGrid({ rack, slots, isDraggingCage, onAddCage, onEditCage, onEditRack }: {
  rack: Rack
  slots: (Cage | null)[]
  isDraggingCage: boolean
  onAddCage: (rackId: number, slot: number) => void
  onEditCage: (cage: Cage) => void
  onEditRack: (rack: Rack) => void
}) {
  const maxColumns = Math.min(rack.slots, 6)
  return (
    <div style={styles.rackSection}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h3 style={{ ...styles.rackLabel, marginBottom: 0, flex: 1 }}>棚: {rack.name} ({slots.filter(Boolean).length}/{rack.slots})</h3>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#718096', padding: '0 4px' }}
          onClick={() => onEditRack(rack)}
          title="棚を編集"
        >
          ✏️
        </button>
      </div>
      <div className="cage-slot-grid" style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${maxColumns}, minmax(160px, 220px))`,
        gap: '0.75rem',
        maxWidth: '100%',
      }}>
        {slots.map((cage, idx) => {
          const slot = idx + 1
          const slotLetter = String.fromCharCode(64 + slot)
          if (cage) {
            return <CageCard key={cage.id} cage={cage} onEdit={onEditCage} slotLetter={slotLetter} />
          } else {
            return (
              <EmptySlot
                key={`empty-${rack.id}-${slot}`}
                rackId={rack.id}
                slot={slot}
                slotLetter={slotLetter}
                isDraggingCage={isDraggingCage}
                onClick={() => onAddCage(rack.id, slot)}
              />
            )
          }
        })}
      </div>
    </div>
  )
}

function EmptySlot({ rackId, slot, slotLetter, isDraggingCage, onClick }: {
  rackId: number
  slot: number
  slotLetter: string
  isDraggingCage: boolean
  onClick: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${rackId}-${slot}`,
    data: { type: 'slot', rackId, slot },
  })

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        borderRadius: '8px',
        padding: '0.6rem',
        minHeight: '100px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px dashed ${isOver && isDraggingCage ? '#48bb78' : '#cbd5e0'}`,
        background: isOver && isDraggingCage ? '#f0fff4' : '#fafafa',
        cursor: 'pointer',
        transition: 'all 0.15s',
        color: '#718096',
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{slotLetter}</div>
      <div style={{ fontSize: '0.75rem', color: '#a0aec0' }}>（クリックで追加）</div>
    </div>
  )
}

function RackDropZone({ rackName, children, isDraggingCage }: {
  rackName: string
  children: React.ReactNode
  isDraggingCage: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `rack-${rackName}`,
    data: { type: 'rack', rackName },
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: '8px',
        padding: isDraggingCage ? '0.5rem' : '0',
        border: isDraggingCage ? `2px dashed ${isOver ? '#48bb78' : '#cbd5e0'}` : '2px solid transparent',
        background: isOver ? '#f0fff4' : 'transparent',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </div>
  )
}

function NonCageSection({ mice }: { mice: Mouse[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'nocage-zone',
    data: { type: 'nocage' },
  })
  return (
    <div style={ncStyles.section}>
      <h3 style={ncStyles.label}>ケージなし（{mice.length}匹）</h3>
      <div
        ref={setNodeRef}
        style={{
          ...ncStyles.dropArea,
          borderColor: isOver ? '#4299e1' : '#cbd5e0',
          background: isOver ? '#ebf8ff' : '#fafafa',
        }}
      >
        {mice.length > 0 ? (
          <div style={ncStyles.mouseGrid}>
            {mice.map((m) => <DraggableMouse key={m.id} mouse={m} sourceCageId={null} />)}
          </div>
        ) : (
          <div style={ncStyles.empty}>ケージが登録されていないマウスはここに表示されます</div>
        )}
      </div>
    </div>
  )
}

const ncStyles: Record<string, React.CSSProperties> = {
  section: { marginTop: '2rem' },
  label: { fontSize: '1rem', color: '#4a5568', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid #e2e8f0' },
  dropArea: { border: '2px dashed', borderRadius: '8px', padding: '0.75rem', minHeight: '80px', transition: 'border-color 0.15s, background 0.15s' },
  mouseGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  empty: { fontSize: '0.85rem', color: '#a0aec0', textAlign: 'center', padding: '1rem' },
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  title: { fontSize: '1.4rem', color: '#2d3748', margin: 0 },
  printBtn: { padding: '0.5rem 1rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  addBtn: { padding: '0.5rem 1rem', background: '#48bb78', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  addRackBtn: { padding: '0.5rem 1rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  rackSection: { marginBottom: '2rem' },
  rackLabel: { fontSize: '1rem', color: '#4a5568', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid #e2e8f0' },
  cageGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
  empty: { textAlign: 'center', padding: '3rem', color: '#a0aec0' },
  dragOverlay: {
    background: '#bee3f8',
    border: '2px solid #4299e1',
    borderRadius: '6px',
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: '10px', padding: '1.5rem', maxWidth: '480px', width: '90%', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  formField: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  formLabel: { fontSize: '0.8rem', fontWeight: 600, color: '#4a5568' },
  formInput: { padding: '0.5rem 0.75rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.88rem' },
  cancelBtn: { padding: '0.5rem 1rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  saveBtn: { padding: '0.5rem 1rem', background: '#48bb78', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  deleteBtn: { padding: '0.5rem 1rem', background: '#fff5f5', color: '#c53030', border: '1px solid #fed7d7', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, marginRight: 'auto' },
}
