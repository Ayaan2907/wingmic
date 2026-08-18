'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { KIND_COLOR } from './graph-style';
import { GraphNodeAvatar } from './GraphNodeAvatar';
import type { GraphNode } from './graph-types';
import { matchGraphNodes } from './match-graph-nodes';

export function GraphSearch({
  nodes,
  onSelect,
}: {
  nodes: GraphNode[];
  onSelect: (node: GraphNode) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const hits = useMemo(() => matchGraphNodes(nodes, query), [nodes, query]);
  const open = query.trim().length > 0;
  const activeId = open && hits[activeIndex] ? `${listId}-opt-${hits[activeIndex]!.id}` : undefined;

  const pick = (node: GraphNode) => {
    onSelect(node);
    setQuery('');
    setActiveIndex(0);
  };

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setQuery('');
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        marginLeft: 'auto',
        flex: '1 1 180px',
        minWidth: 160,
        maxWidth: 280,
      }}
    >
      <input
        data-testid="graph-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setQuery('');
            return;
          }
          if (e.key === 'ArrowDown' && hits.length > 0) {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % hits.length);
            return;
          }
          if (e.key === 'ArrowUp' && hits.length > 0) {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
            return;
          }
          if (e.key === 'Enter' && hits[activeIndex]) {
            e.preventDefault();
            pick(hits[activeIndex]!);
          }
        }}
        placeholder="search this graph"
        aria-label="search this graph"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        className="mono"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(10,10,10,0.85)',
          border: '1px solid var(--border-soft)',
          color: 'var(--ink)',
          fontSize: 11,
          letterSpacing: 0.4,
          outline: 'none',
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          data-testid="graph-search-results"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 5,
            margin: 0,
            padding: 6,
            listStyle: 'none',
            maxHeight: 260,
            overflowY: 'auto',
            borderRadius: 12,
            background: 'var(--bg-elev, #111)',
            border: '1px solid var(--border-soft)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
          }}
        >
          {hits.length === 0 ? (
            <li
              className="mono"
              style={{
                padding: '10px 8px',
                fontSize: 11,
                color: 'var(--text-55)',
              }}
            >
              no matches in your graph
            </li>
          ) : (
            hits.map((node, i) => {
              const selected = i === activeIndex;
              return (
                <li key={node.id} role="presentation">
                  <div
                    id={`${listId}-opt-${node.id}`}
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    onClick={() => pick(node)}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '7px 8px',
                      borderRadius: 8,
                      background: selected ? 'rgba(255,255,255,0.06)' : 'transparent',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxSizing: 'border-box',
                    }}
                  >
                    <GraphNodeAvatar node={node} size={28} />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 650,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {node.label}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          letterSpacing: 1,
                          textTransform: 'uppercase',
                          color: KIND_COLOR[node.kind],
                        }}
                      >
                        {node.kind}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
