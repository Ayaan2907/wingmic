'use client';

import { useId, useMemo, useState } from 'react';
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
  const listId = useId();
  const hits = useMemo(() => matchGraphNodes(nodes, query), [nodes, query]);
  const open = query.trim().length > 0;

  const pick = (node: GraphNode) => {
    onSelect(node);
    setQuery('');
  };

  return (
    <div
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
          if (e.key === 'Enter' && hits[0]) {
            e.preventDefault();
            pick(hits[0]);
          }
        }}
        placeholder="search this graph"
        aria-label="search this graph"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className="mono"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(10,10,10,0.85)',
          border: '1px solid var(--hair)',
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
            border: '1px solid var(--hair)',
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
            hits.map((node) => (
              <li key={node.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => pick(node)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '7px 8px',
                    border: 'none',
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    textAlign: 'left',
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
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
