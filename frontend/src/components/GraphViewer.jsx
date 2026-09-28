import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { Loader2, Network, RefreshCw, X } from 'lucide-react'
import { getGraph } from '../api'
import { Button } from './ui/button'

// Warm amber-terminal palette — no blue/green/purple brand hues.
const TYPE_COLORS = {
  person: '#b4650f',
  organization: '#7a4108',
  method: '#d97706',
  concept: '#c2790f',
  artifact: '#a16207',
  content: '#92400e',
  event: '#78350f',
  data: '#a89a7c',
  dataset: '#a89a7c',
  location: '#7c6e52',
  metric: '#f0a93b',
  other: '#8a7a5c',
  UNKNOWN: '#6b5d45',
}

function colorForType(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.UNKNOWN
}

export default function GraphViewer({ onClose }) {
  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [limit, setLimit] = useState(400)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [hover, setHover] = useState(null)

  const load = useCallback(async (nodeLimit) => {
    setLoading(true)
    setError(null)
    try {
      const graph = await getGraph(nodeLimit)
      setData(graph)
      setSelected(null)
    } catch (err) {
      setError(err.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(limit)
  }, [limit, load])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] }
    return {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    }
  }, [data])

  const neighborIds = useMemo(() => {
    if (!hover && !selected) return null
    const focus = selected?.id || hover
    const ids = new Set([focus])
    for (const link of graphData.links) {
      const s = typeof link.source === 'object' ? link.source.id : link.source
      const t = typeof link.target === 'object' ? link.target.id : link.target
      if (s === focus) ids.add(t)
      if (t === focus) ids.add(s)
    }
    return ids
  }, [graphData.links, hover, selected])

  const typeCounts = useMemo(() => {
    if (!data) return []
    const counts = {}
    for (const node of data.nodes) {
      counts[node.entity_type] = (counts[node.entity_type] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [data])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Knowledge graph</h2>
        </div>

        {data && (
          <p className="text-xs text-muted-foreground">
            Showing {data.nodes.length.toLocaleString()} / {data.total_nodes.toLocaleString()} nodes
            {' · '}
            {data.links.length.toLocaleString()} edges
            {data.truncated ? ' · top by degree' : ''}
          </p>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Max nodes
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              <option value={200}>200</option>
              <option value={400}>400</option>
              <option value={800}>800</option>
              <option value={1500}>1500</option>
              <option value={5000}>All</option>
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load(limit)}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            Chat
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1" ref={containerRef}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="max-w-md rounded-xl border border-border bg-card p-4 text-sm text-card-foreground">
              <p className="font-medium">Could not load graph</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <ForceGraph2D
            ref={graphRef}
            width={size.width}
            height={size.height}
            graphData={graphData}
            backgroundColor="rgba(0,0,0,0)"
            nodeRelSize={5}
            linkWidth={(link) => Math.min(3, 0.6 + (link.weight || 1) * 0.3)}
            linkColor={() => 'rgba(180, 140, 80, 0.35)'}
            cooldownTicks={120}
            onNodeClick={(node) => setSelected(node)}
            onNodeHover={(node) => setHover(node?.id || null)}
            onBackgroundClick={() => setSelected(null)}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const focused = !neighborIds || neighborIds.has(node.id)
              const radius = 3 + Math.min(8, Math.sqrt(node.degree || 1))
              ctx.beginPath()
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
              ctx.fillStyle = focused ? colorForType(node.entity_type) : 'rgba(140,120,90,0.2)'
              ctx.fill()

              const label = node.label || node.id
              const showLabel = globalScale > 1.4 || selected?.id === node.id || hover === node.id
              if (showLabel && focused) {
                const fontSize = 12 / globalScale
                ctx.font = `${fontSize}px Geist Variable, sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'
                ctx.fillStyle = 'rgba(33, 26, 15, 0.85)'
                if (document.documentElement.classList.contains('dark')) {
                  ctx.fillStyle = 'rgba(242, 234, 216, 0.9)'
                }
                ctx.fillText(label.slice(0, 42), node.x, node.y + radius + 1)
              }
            }}
            nodePointerAreaPaint={(node, color, ctx) => {
              const radius = 4 + Math.min(8, Math.sqrt(node.degree || 1))
              ctx.beginPath()
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
              ctx.fillStyle = color
              ctx.fill()
            }}
          />
        )}

        {selected && (
          <aside className="absolute bottom-3 left-3 right-3 z-20 max-h-[40%] overflow-y-auto rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur md:left-auto md:right-3 md:w-80 md:max-h-[70%]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-card-foreground">{selected.label}</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {selected.entity_type} · degree {selected.degree}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close details"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {selected.description && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{selected.description}</p>
            )}
          </aside>
        )}

        {typeCounts.length > 0 && !selected && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 hidden max-w-xs flex-wrap gap-1.5 rounded-lg border border-border bg-card/90 p-2 text-[10px] backdrop-blur sm:flex">
            {typeCounts.slice(0, 8).map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: colorForType(type) }}
                />
                {type} {count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
