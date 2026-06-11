'use client'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Cage, Mouse } from '@/types'
import { GENOTYPE_FIELDS } from '@/types'
import { GenotypeBadgeList } from '@/components/GenotypeBadge'

interface CageCardProps {
  cage: Cage
  onEdit: (cage: Cage) => void
  slotLetter?: string
}

export default function CageCard({ cage, onEdit, slotLetter }: CageCardProps) {
  // Droppable zone for mice
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `cage-${cage.id}`,
    data: { type: 'cage', cageId: cage.id },
  })

  // Draggable for moving cage between racks
  const {
    attributes: cageAttr,
    listeners: cageListen,
    setNodeRef: cageDragRef,
    transform,
    isDragging: cageIsDragging,
  } = useDraggable({
    id: `cage-drag-${cage.id}`,
    data: { type: 'cage', cageDbId: cage.id },
  })

  const occupancy = cage.mice.length
  const isFull = occupancy >= cage.capacity

  return (
    <div
      ref={(el) => { dropRef(el); cageDragRef(el) }}
      style={{
        ...styles.card,
        transform: CSS.Translate.toString(transform),
        opacity: cageIsDragging ? 0.5 : 1,
        border: isOver ? '2px solid #4299e1' : '2px solid transparent',
        background: isOver ? '#ebf8ff' : '#fff',
        outline: isFull ? '2px solid #f6ad55' : 'none',
      }}
    >
      <div style={styles.cardHeader}>
        <span style={styles.dragHandle} {...cageAttr} {...cageListen} title="ドラッグでケージを移動">⠿</span>
        <span style={styles.cageId}>{cage.cage_id}</span>
        {cage.type === 'mating' && <span style={styles.matingBadge}>交配</span>}
        {slotLetter && <span style={styles.slotBadge}>{slotLetter}</span>}
        <span style={styles.occupancy}>{occupancy}/{cage.capacity}</span>
        <button style={styles.editBtn} onClick={(e) => { e.stopPropagation(); onEdit(cage) }}>✏️</button>
      </div>
      {cage.type === 'mating' && cage.matingRecord ? (
        <div style={styles.strain}>
          {cage.matingRecord.strain1?.name} × {cage.matingRecord.strain2?.name}
        </div>
      ) : (
        cage.strain && <div style={styles.strain}>{cage.strain}</div>
      )}

      <div style={styles.mouseList}>
        {cage.mice.map((m) => (
          <DraggableMouse key={m.id} mouse={m} sourceCageId={cage.id} />
        ))}
        {cage.mice.length === 0 && (
          <div style={styles.empty}>（空）</div>
        )}
      </div>

      {cage.notes && <div style={styles.notes}>{cage.notes}</div>}
    </div>
  )
}

export interface DraggableMouseProps {
  mouse: Mouse
  sourceCageId: number | null
}

export function DraggableMouse({ mouse, sourceCageId }: DraggableMouseProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `mouse-${mouse.id}`,
    data: { type: 'mouse', mouseId: mouse.id, sourceCageId },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    ...styles.mouseItem,
    background: isDragging ? '#bee3f8' : '#f7fafc',
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  const genotypeEntries = mouse.genotypes && Object.keys(mouse.genotypes).length > 0
    ? Object.entries(mouse.genotypes).map(([k, v]) => ({ key: k, value: v }))
    : GENOTYPE_FIELDS
        .filter((f) => (mouse as any)[f.key])
        .map((f) => ({ key: f.label, value: (mouse as any)[f.key] }))

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={styles.mouseTop}>
        <span style={styles.mouseName}>{mouse.name}</span>
        <span style={styles.mouseSex}>{mouse.sex}</span>
        {mouse.marking && <span style={styles.mouseMarking}>{mouse.marking}</span>}
        {mouse.weeks != null && <span style={styles.mouseWeeks}>{mouse.weeks}w</span>}
      </div>
      {genotypeEntries.length > 0 && (
        <div style={styles.mouseGenotypeContainer}>
          <GenotypeBadgeList entries={genotypeEntries} />
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: '8px',
    padding: '0.6rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    minWidth: '160px',
    maxWidth: '220px',
    minHeight: '100px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    transition: 'border 0.15s, background 0.15s',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  dragHandle: {
    cursor: 'grab',
    color: '#cbd5e0',
    fontSize: '1rem',
    lineHeight: 1,
    padding: '0 2px',
    userSelect: 'none',
  },
  cageId: {
    fontWeight: 700,
    fontSize: '0.85rem',
    color: '#2d3748',
    flex: 1,
  },
  occupancy: {
    fontSize: '0.72rem',
    color: '#718096',
    background: '#e2e8f0',
    padding: '1px 6px',
    borderRadius: '10px',
  },
  editBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '0',
    lineHeight: 1,
  },
  matingBadge: {
    fontSize: '0.65rem',
    background: '#fbb6ce',
    color: '#c53030',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 600,
  },
  slotBadge: {
    fontSize: '0.65rem',
    background: '#d6bcfa',
    color: '#6d28d9',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 600,
  },
  strain: {
    fontSize: '0.72rem',
    color: '#4a5568',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mouseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: 1,
  },
  mouseItem: {
    borderRadius: '4px',
    padding: '0.3rem 0.4rem',
    fontSize: '0.75rem',
    userSelect: 'none',
    border: '1px solid #e2e8f0',
  },
  mouseTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    flexWrap: 'wrap',
  },
  mouseName: {
    fontWeight: 600,
    color: '#2d3748',
  },
  mouseSex: {
    color: '#4299e1',
  },
  mouseMarking: {
    color: '#718096',
  },
  mouseWeeks: {
    marginLeft: 'auto',
    color: '#68d391',
    fontWeight: 600,
  },
  mouseGenotypeContainer: {
    marginTop: '0.1rem',
  },
  empty: {
    fontSize: '0.75rem',
    color: '#a0aec0',
    textAlign: 'center',
    padding: '0.5rem',
  },
  notes: {
    fontSize: '0.7rem',
    color: '#a0aec0',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '0.3rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}
