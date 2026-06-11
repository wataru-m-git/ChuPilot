'use client'

import React from 'react'

type GenotypeValue = 'homo' | 'hetero' | 'null' | string | null | undefined

const COLOR_MAP: Record<string, { bg: string; color: string }> = {
  homo: { bg: '#FC8181', color: '#742A2A' },
  hetero: { bg: '#D6BCFA', color: '#44337A' },
  null: { bg: '#CBD5E0', color: '#2D3748' },
}

interface GenotypeBadgeProps {
  value: GenotypeValue
}

export function GenotypeBadge({ value }: GenotypeBadgeProps) {
  if (!value) return null
  const colors = COLOR_MAP[value] ?? { bg: '#EDF2F7', color: '#4A5568' }
  const style: React.CSSProperties = {
    display: 'inline-block',
    background: colors.bg,
    color: colors.color,
    borderRadius: '50px',
    padding: '1px 8px',
    fontSize: '0.7rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }
  return <span style={style}>{value}</span>
}

interface GenotypeEntry {
  key: string
  value: string | null | undefined
}

interface GenotypeBadgeListProps {
  entries: GenotypeEntry[]
}

export function GenotypeBadgeList({ entries }: GenotypeBadgeListProps) {
  const filtered = entries.filter((e) => e.value != null)
  if (filtered.length === 0) return <span style={{ color: '#a0aec0' }}>-</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
      {filtered.map(({ key, value }) => (
        <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '0.65rem', color: '#718096' }}>{key}:</span>
          <GenotypeBadge value={value} />
        </span>
      ))}
    </div>
  )
}
