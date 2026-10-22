import { Children, cloneElement, isValidElement, memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { BaseEdge, ConnectionMode, getBezierPath, Handle, Position, ReactFlow, SelectionMode, useUpdateNodeInternals, type Connection, type ConnectionLineComponentProps, type Edge, type EdgeChange, type EdgeProps, type Node, type NodeChange, type NodeProps } from '@xyflow/react';
import { boundsOf, type CanvasImage, type Viewport } from '../canvas';
import { canConnectCanvasNodes, canvasConnectionSides, type CanvasConnection, type CanvasConnectionInput, type CanvasConnectionNode, type CanvasConnectionNodes } from '../canvas-connections';
import { magneticDragDelta, type DragSnapContext, type SnapGuides } from '../canvas-snapping';
import { ImageConnection } from './ImageConnection';
import { flowNodeGeometry } from '../react-flow-geometry';
import type { Locale } from '../i18n';
import { CanvasConnectionHandle, type AddConnectionMedia } from './CanvasConnectionHandle';
import './react-flow-canvas.css';

type ContentProps = { children?: ReactNode; style?: CSSProperties; className?: string; 'data-canvas-id'?: string; 'data-fusion-id'?: string; image?: CanvasImage; target?: CanvasImage; active?: boolean; zoom?: number };
type ContentNode = Node<{ content: ReactElement<ContentProps>; connectionNode?: CanvasConnectionNode; freeConnections: boolean; connectable: boolean; zoom: number; locale?: Locale; onAddConnectionMedia?: AddConnectionMedia }, 'lightchain'>;
type ConnectionEdge = Edge<{ image: CanvasImage; target: CanvasImage; active: boolean; zoom: number; freeConnections: boolean }, 'lightchain'>;
type FreeConnectionEdge = Edge<{ zoom: number }, 'lightchain-free'>;
type CanvasEdge = ConnectionEdge | FreeConnectionEdge;
const handles = [Position.Left, Position.Right];
const freeHandles = [Position.Left, Position.Right];
const LightchainNode = memo(({ id, data }: NodeProps<ContentNode>) => {
  const updateNodeInternals = useUpdateNodeInternals();
  useLayoutEffect(() => {
    // Keep DOM measurements in sync with the same declared handle geometry.
    // Controlled updates can render edges immediately, before this refresh.
    if (data.freeConnections) updateNodeInternals(id);
  }, [id, data.freeConnections, data.connectionNode?.kind, data.zoom, updateNodeInternals]);
  return <>
    {!data.freeConnections && handles.flatMap(side => ['source', 'target'].map(type => <Handle key={`${type}-${side}`} id={`${type}-${side}`} type={type as 'source' | 'target'} position={side} isConnectable={false} className="lc-flow-handle" />))}
    {data.content}
    {data.freeConnections && canvasConnectionSides(data.connectionNode).map(side => <CanvasConnectionHandle key={`free-${side}`}
      nodeId={id} side={side} node={data.connectionNode} connectable={data.connectable} locale={data.locale} onAdd={data.onAddConnectionMedia} />)}
  </>;
});
const LightchainEdge = memo((props: EdgeProps<ConnectionEdge>) => {
  const { data } = props;
  if (!data) return null;
  const { image, target, active, zoom } = data;
  const right = target.x + target.width / 2 >= image.x + image.width / 2;
  const direction = right ? 1 : -1, gap = (active ? 4 : 2) / zoom;
  const sx = image.x + (right ? image.width : 0) + gap * direction, sy = image.y + image.height / 2;
  const tx = target.x + (right ? 0 : target.width) - gap * direction, ty = target.y + target.height / 2;
  const handle = Math.max(48, Math.abs(tx - sx) * .45);
  // The video workspace always binds material output on the right to editor
  // input on the left. Fusion retains its position-dependent business lines.
  const d = data.freeConnections ? getBezierPath(props)[0]
    : `M ${sx} ${sy} C ${sx + handle * direction} ${sy}, ${tx - handle * direction} ${ty}, ${tx} ${ty}`;
  // React Flow scales an HTML viewport around the SVG. Compensate explicitly
  // for that scale instead of relying on SVG-only non-scaling-stroke behavior.
  return <g className="lc-flow-connection" data-active={active} style={{ '--canvas-inverse-scale': 1 / zoom } as CSSProperties}>
    {active && <path d={d} className="lc-flow-edge-underlay" />}
    <path d={d} className="lc-flow-edge-line" />
  </g>;
});
const LightchainFreeEdge = memo((props: EdgeProps<FreeConnectionEdge>) => {
  const [path] = getBezierPath(props);
  const zoom = props.data?.zoom ?? 1;
  return <g className="lc-flow-connection" data-active={!!props.selected} style={{ '--canvas-inverse-scale': 1 / zoom } as CSSProperties}>
    {props.selected && <path d={path} className="lc-flow-edge-underlay" />}
    <BaseEdge path={path} className="lc-flow-edge-line" interactionWidth={20 / zoom} />
  </g>;
});
const LightchainConnectionLine = (props: ConnectionLineComponentProps<ContentNode>) => {
  const [path] = getBezierPath({ sourceX: props.fromX, sourceY: props.fromY, sourcePosition: props.fromPosition,
    targetX: props.toX, targetY: props.toY, targetPosition: props.toPosition });
  return <g className="lc-flow-connection lc-flow-draft-connection" data-active="true" data-invalid={props.connectionStatus === 'invalid'}>
    <path d={path} className="lc-flow-edge-underlay" /><path d={path} className="lc-flow-edge-line" />
  </g>;
};
const nodeTypes = { lightchain: LightchainNode };
const edgeTypes = { lightchain: LightchainEdge, 'lightchain-free': LightchainFreeEdge };
const controlSelector = 'button,input,textarea,select,[contenteditable="true"],[data-select-popup]';

type Props = {
  children: ReactNode; view: Viewport; selectedIds: string[]; hand: boolean; referenceMode: boolean; snap: boolean;
  onView: (view: Viewport) => void; onSelection: (ids: string[]) => void;
  onPositions: (positions: Map<string, { x: number; y: number }>) => void;
  onSelecting: (active: boolean) => void; onDragStart: () => void; onDragEnd: () => void; onGuides: (guides: SnapGuides | null) => void;
  connections?: CanvasConnection[]; selectedConnectionIds?: string[];
  connectionNodes?: CanvasConnectionNodes;
  locale?: Locale;
  onAddConnectionMedia?: AddConnectionMedia;
  validateConnection?: (connection: CanvasConnectionInput, replacingId?: string) => boolean;
  onConnect?: (connection: CanvasConnectionInput) => void;
  onReconnect?: (id: string, connection: CanvasConnectionInput) => void;
  onConnectionSelection?: (ids: string[]) => void;
};

// Adapts the existing product components/data to real React Flow nodes and edges.
// Business operations and their history continue to use the shared canvas model.
export function ReactFlowCanvas(props: Props) {
  const latest = useRef(props); latest.current = props;
  const selectionRef = useRef(props.selectedIds); selectionRef.current = props.selectedIds;
  const connectionSelectionRef = useRef(props.selectedConnectionIds ?? []); connectionSelectionRef.current = props.selectedConnectionIds ?? [];
  const [connecting, setConnecting] = useState(false);
  const reconnectingId = useRef<string | null>(null);
  const freeConnections = !!props.onConnect;
  const connectable = freeConnections && !props.hand && !props.referenceMode;
  const shiftClick = useRef(false);
  const setSelection = useCallback((ids: string[]) => {
    // React Flow can emit several changes before the controlled props render.
    selectionRef.current = ids;
    latest.current.onSelection(ids);
  }, []);
  const setConnectionSelection = useCallback((ids: string[]) => {
    connectionSelectionRef.current = ids;
    latest.current.onConnectionSelection?.(ids);
  }, []);
  const drag = useRef<{ anchor: string; start: Map<string, {x: number; y: number}>; snap: DragSnapContext } | null>(null);
  const bypass = useRef(false);
  const graph = useMemo(() => {
    const nodes: ContentNode[] = [], edges: CanvasEdge[] = [];
    const visit = (children: ReactNode) => Children.forEach(children, child => {
      if (!isValidElement<ContentProps>(child)) return;
      const p = child.props;
      if (child.type === ImageConnection && p.image && p.target) {
        const right = p.target.x + p.target.width / 2 >= p.image.x + p.image.width / 2;
        edges.push({ id: `${p.image.id}->${p.target.id}`, source: p.image.id, target: p.target.id, type: 'lightchain',
          sourceHandle: freeConnections ? 'free-right' : `source-${right ? 'right' : 'left'}`,
          targetHandle: freeConnections ? 'free-left' : `target-${right ? 'left' : 'right'}`,
          selectable: false, focusable: false, reconnectable: false, zIndex: p.active ? 4 : -1,
          data: { image: p.image, target: p.target, active: !!p.active, zoom: props.view.zoom, freeConnections } });
      } else if (p['data-canvas-id'] || p['data-fusion-id']) {
        const id = p['data-canvas-id'] ?? `${p['data-fusion-id']}:fusion`;
        const style = p.style ?? {};
        const connectionNode = props.connectionNodes?.[id];
        nodes.push({ id, type: 'lightchain', position: { x: Number(style.left), y: Number(style.top) },
          ...flowNodeGeometry(Number(style.width) || 280, Number(style.height) || 400,
            freeConnections ? { sides: canvasConnectionSides(connectionNode), zoom: props.view.zoom } : undefined),
          selected: props.selectedIds.includes(id), zIndex: Number(style.zIndex) || 1,
          data: { content: cloneElement(child, { style: { ...style, left: 0, top: 0, position: 'relative', zIndex: undefined } }),
            connectionNode, freeConnections, connectable, zoom: props.view.zoom, locale: props.locale, onAddConnectionMedia: props.onAddConnectionMedia } });
      } else visit(p.children);
    });
    visit(props.children);
    if (freeConnections) {
      const nodeIds = new Set(nodes.map(node => node.id));
      for (const connection of props.connections ?? []) {
        if (!nodeIds.has(connection.source) || !nodeIds.has(connection.target)) continue;
        const selected = !!props.selectedConnectionIds?.includes(connection.id);
        edges.push({ ...connection, sourceHandle: connection.sourceHandle ?? 'free-right', targetHandle: connection.targetHandle ?? 'free-left',
          type: 'lightchain-free', className: 'lc-flow-free-edge', selected, selectable: connectable, focusable: false,
          reconnectable: connectable && selected && !!props.onReconnect, zIndex: 0, data: { zoom: props.view.zoom } });
      }
    }
    return { nodes, edges };
  }, [props.children, props.selectedIds, props.view.zoom, props.connections, props.connectionNodes, props.selectedConnectionIds, props.onReconnect, props.locale, props.onAddConnectionMedia, freeConnections, connectable]);
  const graphRef = useRef(graph); graphRef.current = graph;
  const isValidConnection = useCallback((connection: Connection | CanvasEdge) => {
    const p = latest.current;
    if (!p.onConnect || p.hand || p.referenceMode || connection.source === connection.target) return false;
    const validHandle = (id: string | null | undefined) => !!id && freeHandles.some(side => id === `free-${side}`);
    if (!validHandle(connection.sourceHandle) || !validHandle(connection.targetHandle)) return false;
    const nodes = graphRef.current.nodes;
    if (!nodes.some(node => node.id === connection.source) || !nodes.some(node => node.id === connection.target)) return false;
    if (p.connectionNodes && !canConnectCanvasNodes({ source: connection.source, target: connection.target,
      sourceHandle: connection.sourceHandle ?? null, targetHandle: connection.targetHandle ?? null }, p.connectionNodes)) return false;
    if (p.validateConnection && !p.validateConnection({ source: connection.source, target: connection.target,
      sourceHandle: connection.sourceHandle ?? null, targetHandle: connection.targetHandle ?? null }, reconnectingId.current ?? undefined)) return false;
    return !graphRef.current.edges.some(edge => edge.id !== reconnectingId.current && edge.source === connection.source && edge.target === connection.target);
  }, []);
  const onEdgeChanges = useCallback((changes: EdgeChange<CanvasEdge>[]) => {
    const p = latest.current;
    if (!p.onConnect || p.hand || p.referenceMode) return;
    const selection = changes.filter(change => change.type === 'select');
    if (!selection.length) return;
    const ids = new Set(connectionSelectionRef.current);
    for (const change of selection) {
      if (!p.connections?.some(connection => connection.id === change.id)) continue;
      change.selected ? ids.add(change.id) : ids.delete(change.id);
    }
    setConnectionSelection([...ids]);
  }, [setConnectionSelection]);
  const onChanges = useCallback((changes: NodeChange<ContentNode>[]) => {
    const p = latest.current;
    if (!p.referenceMode) {
      const selection = changes.filter(change => change.type === 'select');
      if (selection.length) {
        const ids = new Set(selectionRef.current);
        for (const change of selection) change.selected ? ids.add(change.id) : ids.delete(change.id);
        setSelection([...ids]);
      }
    }
    const positions = new Map<string, {x: number; y: number}>();
    for (const change of changes) if (change.type === 'position' && change.position) positions.set(change.id, change.position);
    const g = drag.current, anchor = g && positions.get(g.anchor), start = g && g.start.get(g.anchor);
    if (g && anchor && start) {
      const delta = magneticDragDelta(g.snap, (anchor.x - start.x) * p.view.zoom, (anchor.y - start.y) * p.view.zoom, p.view.zoom, p.snap && !bypass.current);
      p.onGuides(delta.guides);
      for (const [id, initial] of g.start) positions.set(id, { x: initial.x + delta.x, y: initial.y + delta.y });
    }
    if (positions.size) p.onPositions(positions);
  }, [setSelection]);
  const beginDrag = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent, node: ContentNode, selected?: ContentNode[]) => {
    bypass.current = event.altKey;
    const all = graphRef.current.nodes.map(n => ({ id: n.id, ...n.position, width: n.width ?? 280, height: n.height ?? 400 })) as CanvasImage[];
    const moving = new Set((selected?.length ? selected : [node]).map(n => n.id)); moving.add(node.id);
    const anchor = all.find(n => n.id === node.id)!;
    const bounds = boundsOf(all.filter(n => moving.has(n.id)))!;
    drag.current = { anchor: node.id, start: new Map(all.filter(n => moving.has(n.id)).map(n => [n.id, { x: n.x, y: n.y }])), snap: { anchor, bounds, targets: all.filter(n => !moving.has(n.id)), locks: {} } };
    latest.current.onDragStart();
  }, []);
  const endDrag = useCallback(() => { drag.current = null; latest.current.onGuides(null); latest.current.onDragEnd(); }, []);
  const onViewport = useCallback((v: Viewport) => {
    const current = latest.current.view;
    // Controlled viewport updates also emit this event. Only user/store changes
    // feed back into App, so its preset-zoom animation is not cancelled by echo.
    if (v.x !== current.x || v.y !== current.y || v.zoom !== current.zoom) latest.current.onView(v);
  }, []);
  return <div className="lc-react-flow" data-hand={props.hand} data-free-connections={freeConnections} data-connectable={connectable} data-connecting={connecting} style={{ '--canvas-inverse-scale': 1 / props.view.zoom } as CSSProperties}
    onPointerMoveCapture={e => { bypass.current = e.altKey; }}
    onPointerDownCapture={e => {
      if (e.target instanceof Element) {
        const control = e.target.closest(controlSelector);
        control?.classList.add('nodrag');
        if (!control) e.currentTarget.closest<HTMLElement>('main')?.focus({ preventScroll: true });
        // Wheel-only rows keep their empty space available for dragging the node.
        // Their buttons remain protected by controlSelector above.
        const field = e.target.closest('textarea,[data-canvas-scroll]:not([data-canvas-scroll="wheel"])');
        field?.classList.add('nodrag');
      }
    }}
    onMouseDownCapture={e => {
      shiftClick.current = false;
      if (e.button !== 0 || props.hand || props.referenceMode || !(e.target instanceof Element)) return;
      if (e.target.closest(`${controlSelector},.react-flow__handle,.react-flow__edgeupdater`)) return;
      const edgeId = e.target.closest('.lc-flow-free-edge')?.getAttribute('data-id');
      if (edgeId && freeConnections) {
        e.preventDefault(); e.stopPropagation(); shiftClick.current = true;
        const ids = connectionSelectionRef.current;
        setConnectionSelection(e.shiftKey ? (ids.includes(edgeId) ? ids.filter(id => id !== edgeId) : [...ids, edgeId]) : [edgeId]);
        if (!e.shiftKey) setSelection([]);
        return;
      }
      const id = e.target.closest('.react-flow__node')?.getAttribute('data-id');
      if (!id) return;
      if (!e.shiftKey) {
        if (freeConnections && connectionSelectionRef.current.length) setConnectionSelection([]);
        return;
      }
      // Handle additive clicks before XYDrag's native mousedown listener.
      // A deselected node would otherwise still become the drag anchor. Reading
      // the mouse modifier also works if Shift was held before canvas focus.
      e.preventDefault();
      e.stopPropagation();
      shiftClick.current = true;
      const ids = selectionRef.current;
      setSelection(ids.includes(id) ? ids.filter(selected => selected !== id) : [...ids, id]);
    }}
    onClickCapture={e => {
      if (!shiftClick.current) return;
      shiftClick.current = false;
      e.stopPropagation();
    }}
    onWheelCapture={e => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.target instanceof Element) {
        const field = e.target.closest('textarea,[data-canvas-scroll]');
        if (field && field.scrollHeight > field.clientHeight) e.stopPropagation();
      }
    }}>
    <ReactFlow<ContentNode, CanvasEdge> nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      defaultViewport={props.view} viewport={props.view} onViewportChange={onViewport} onNodesChange={onChanges} onEdgesChange={onEdgeChanges}
      onSelectionStart={() => latest.current.onSelecting(true)} onSelectionEnd={() => latest.current.onSelecting(false)}
      onNodeDragStart={beginDrag} onNodeDragStop={endDrag}
      onSelectionDragStart={(e, nodes) => { if (nodes[0]) beginDrag(e, nodes[0], nodes); }} onSelectionDragStop={endDrag}
      nodeDragThreshold={0}
      nodesDraggable={!props.hand && !props.referenceMode} elementsSelectable={!props.hand && !props.referenceMode}
      // Blank-space dragging already enables marquee selection. Binding Shift
      // to it too makes Pane capture node clicks before additive selection.
      selectionOnDrag={!props.hand && !props.referenceMode} selectionMode={SelectionMode.Partial} selectionKeyCode={null} multiSelectionKeyCode="Shift"
      panOnDrag={props.hand || props.referenceMode ? true : [1]} panActivationKeyCode="Space"
      panOnScroll panOnScrollSpeed={1} zoomOnScroll={false} zoomOnPinch zoomActivationKeyCode={['Alt','Meta','Control']}
      proOptions={{ hideAttribution: true }}
      minZoom={0.03} maxZoom={2} zoomOnDoubleClick={false} deleteKeyCode={null}
      nodesConnectable={connectable} edgesReconnectable={false} connectionMode={ConnectionMode.Loose} connectOnClick={false}
      isValidConnection={isValidConnection} connectionLineComponent={LightchainConnectionLine} connectionRadius={24 / props.view.zoom} reconnectRadius={8 / props.view.zoom}
      onConnect={connection => { if (isValidConnection(connection)) latest.current.onConnect?.(connection); }}
      onConnectStart={() => setConnecting(true)} onConnectEnd={() => setConnecting(false)}
      onReconnect={props.onReconnect ? (edge, connection) => { if (edge.type === 'lightchain-free' && isValidConnection(connection)) latest.current.onReconnect?.(edge.id, connection); } : undefined}
      onReconnectStart={(_, edge) => { reconnectingId.current = edge.id; setConnecting(true); }}
      onReconnectEnd={() => { reconnectingId.current = null; setConnecting(false); }}
      elevateNodesOnSelect={false} elevateEdgesOnSelect={false}
      autoPanOnNodeDrag={false} autoPanOnSelection={false} autoPanOnConnect={false} disableKeyboardA11y
      onPaneClick={() => {
        if (!latest.current.referenceMode && !latest.current.hand) {
          setSelection([]);
          if (latest.current.onConnect) setConnectionSelection([]);
        }
      }} />
  </div>;
}
