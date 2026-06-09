/**
 * Mission Feed — home page.
 *
 * Shows a filterable, scrollable feed of missions filtered by the user's
 * chosen value tags. In production:
 *  - Selected values are read from the user's profile (persisted to backend).
 *  - Each card's "spots left" count is populated from getMission().remaining
 *    via useReadContract for live on-chain data.
 * For MVP / design, mock data and localStorage-persisted value selections
 * are used.
 */

import React, { useState, useEffect } from 'react';
import MissionCard from '@/components/MissionCard';
import {
  MOCK_MISSIONS,
  ALL_VALUES,
  filterMissionsByValues,
  type ValueTag,
} from '@/lib/mockData';

const STORAGE_KEY = 'socialstack:values';

function loadValues(): ValueTag[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ValueTag[]) : [];
  } catch {
    return [];
  }
}

function saveValues(values: ValueTag[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

export default function MissionFeed() {
  const [selectedValues, setSelectedValues] = useState<ValueTag[]>([]);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setSelectedValues(loadValues());
    setMounted(true);
  }, []);

  function toggleValue(v: ValueTag) {
    setSelectedValues((prev) => {
      const next = prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v];
      saveValues(next);
      return next;
    });
  }

  const filtered = filterMissionsByValues(MOCK_MISSIONS, selectedValues);

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '28px 16px 64px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Mission Feed</h1>
      <p style={{ color: '#718096', marginBottom: 24, marginTop: 0 }}>
        Complete missions, earn IMPACT, create real-world change.
      </p>

      {/* Value filter pills */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 8 }}>
          Filter by your values
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALL_VALUES.map((v) => {
            const active = selectedValues.includes(v);
            return (
              <button
                key={v}
                onClick={() => toggleValue(v)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 100,
                  border: active ? '2px solid #276749' : '1px solid #cbd5e0',
                  background: active ? '#f0fdf4' : '#fff',
                  color: active ? '#276749' : '#4a5568',
                  fontWeight: active ? 700 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {v}
              </button>
            );
          })}
          {selectedValues.length > 0 && (
            <button
              onClick={() => {
                setSelectedValues([]);
                saveValues([]);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 100,
                border: '1px solid #fed7d7',
                background: '#fff5f5',
                color: '#c53030',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Mission count */}
      {mounted && (
        <p style={{ fontSize: 13, color: '#a0aec0', marginBottom: 16 }}>
          {filtered.length} mission{filtered.length !== 1 ? 's' : ''}
          {selectedValues.length > 0 ? ' matching your values' : ''}
        </p>
      )}

      {/* Feed */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 0',
            color: '#a0aec0',
          }}
        >
          <p style={{ fontSize: 16 }}>No missions match the selected values.</p>
          <p style={{ fontSize: 13 }}>Try removing some filters above.</p>
        </div>
      ) : (
        filtered.map((m) => <MissionCard key={m.id.toString()} mission={m} />)
      )}
    </main>
  );
}
