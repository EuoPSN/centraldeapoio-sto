import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Panel,
  addEdge, useNodesState, useEdgesState, MarkerType, Handle, Position,
  type Node, type Edge, type Connection, type NodeProps, type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFlowGraph, saveFlowGraph } from "@/lib/flow-graph.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";
import { toast } from "sonner";
import {
  Plus, Save, Trash2, Play, MessageCircle, HelpCircle, AlertOctagon, FileText, Square, CircleDot,
} from "lucide-react";

type NodeKind = "start" | "step" | "question" | "objection" | "script" | "end";

interface BlockTypeDef {
  kind: NodeKind;
  label: string;
  color: string;
  icon: typeof MessageCircle;
}

const BLOCK_TYPES: BlockTypeDef[] = [
  { kind: "start",     label: "Início",       color: "#10b981", icon: CircleDot },
  { kind: "step",      label: "Etapa",        color: "#10b981", icon: MessageCircle },
  { kind: "question",  label: "Pergunta",     color: "#3b82f6", icon: HelpCircle },
  { kind: "objection", label: "Objeção",      color: "#f59e0b", icon: AlertOctagon },
  { kind: "script",    label: "Script",       color: "#a855f7", icon: FileText },
  { kind: "end",       label: "Encerramento", color: "#ef4444", icon: Square },
];

const KIND_INDEX = Object.fromEntries(BLOCK_TYPES.map((b) => [b.kind, b])) as Record<NodeKind, BlockTypeDef>;

interface NodeData {
  kind: NodeKind;
  title: string;
  message?: string | null;
  note?: string | null;
  color?: string | null;
  icon?: string | null;
  [key: string]: unknown;
}

// ============ Custom Node ============
function BlockNode({ data, selected }: NodeProps) {
  const d = data as unknown as NodeData;
  const def = KIND_INDEX[d.kind] ?? KIND_INDEX.step;
  const color = d.color || def.color;
  const Icon = def.icon;

  return (
    <div
      className={`rounded-xl border-2 bg-card shadow-md min-w-[200px] max-w-[280px] transition ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="px-3 py-2 rounded-t-[10px] flex items-center gap-2 text-white text-xs font-semibold uppercase tracking-wide"
           style={{ background: color }}>
        <Icon className="h-3.5 w-3.5" />
        {def.label}
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-semibold">{d.title || "(sem título)"}</p>
        {d.message && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{d.message}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { block: BlockNode };

// ============ Editor ============
interface Props { flowId: string; canEdit: boolean; }

export function FlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function FlowEditorInner({ flowId, canEdit }: Props) {
  const getFn = useServerFn(getFlowGraph);
  const saveFn = useServerFn(saveFlowGraph);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["flow-graph", flowId], queryFn: () => getFn({ data: { id: flowId } }) });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);

  // Hidrata do servidor
  useEffect(() => {
    if (!q.data) return;
    const ns: Node[] = q.data.nodes.map((n) => ({
      id: n.id,
      type: "block",
      position: { x: n.position_x ?? 0, y: n.position_y ?? 0 },
      data: {
        kind: (n.node_type as NodeKind) ?? "step",
        title: n.title,
        message: n.message,
        note: n.note,
        color: n.color,
        icon: n.icon,
      } as NodeData,
    }));
    const es: Edge[] = q.data.edges.map((e) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      label: e.label ?? undefined,
      markerEnd: { type: MarkerType.ArrowClosed },
      type: "smoothstep",
    }));
    setNodes(ns);
    setEdges(es);
    setDirty(false);
  }, [q.data, setNodes, setEdges]);

  const onConnect = useCallback((conn: Connection) => {
    setEdges((eds) => addEdge({ ...conn, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    setDirty(true);
  }, [setEdges]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId), [nodes, selectedId]);

  const addBlock = (kind: NodeKind) => {
    if (!canEdit) return;
    const def = KIND_INDEX[kind];
    const id = crypto.randomUUID();
    const center = rfRef.current?.screenToFlowPosition({ x: 300, y: 200 }) ?? { x: 100, y: 100 };
    const newNode: Node = {
      id,
      type: "block",
      position: { x: center.x + Math.random() * 80, y: center.y + Math.random() * 80 },
      data: { kind, title: `Novo ${def.label}`, message: "", note: "", color: def.color } as NodeData,
    };
    setNodes((ns) => [...ns, newNode]);
    setSelectedId(id);
    setDirty(true);
  };

  const updateNode = (patch: Partial<NodeData>) => {
    if (!selectedId) return;
    setNodes((ns) => ns.map((n) => n.id === selectedId
      ? { ...n, data: { ...(n.data as NodeData), ...patch } as never } : n));
    setDirty(true);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
    setDirty(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        flow_id: flowId,
        nodes: nodes.map((n) => {
          const d = n.data as NodeData;
          return {
            id: n.id,
            node_type: d.kind,
            title: d.title || "(sem título)",
            message: d.message ?? null,
            note: d.note ?? null,
            position_x: n.position.x,
            position_y: n.position.y,
            color: d.color ?? null,
            icon: d.icon ?? null,
            data: {},
          };
        }),
        edges: edges.map((e) => ({
          id: e.id,
          source_node_id: e.source,
          target_node_id: e.target,
          source_handle: e.sourceHandle ?? null,
          target_handle: e.targetHandle ?? null,
          label: typeof e.label === "string" ? e.label : null,
        })),
      };
      return saveFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Fluxo salvo.");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["flow-graph", flowId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  if (q.isLoading) return <div className="p-10 text-center text-muted-foreground">Carregando fluxo...</div>;

  return (
    <div ref={wrapperRef} className="relative w-full h-[calc(100vh-220px)] min-h-[500px] border border-border rounded-lg overflow-hidden bg-muted/20">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type === "position" || x.type === "remove")) setDirty(true); }}
        onEdgesChange={(c) => { onEdgesChange(c); if (c.some((x) => x.type === "remove")) setDirty(true); }}
        onConnect={canEdit ? onConnect : undefined}
        onInit={(inst) => { rfRef.current = inst; }}
        onNodeClick={(_, n) => setSelectedId(n.id)}
        onPaneClick={() => setSelectedId(null)}
        onEdgeDoubleClick={(_, e) => {
          if (!canEdit) return;
          const label = prompt("Label da conexão:", typeof e.label === "string" ? e.label : "");
          if (label !== null) {
            setEdges((es) => es.map((x) => x.id === e.id ? { ...x, label } : x));
            setDirty(true);
          }
        }}
        fitView
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        edgesReconnectable={canEdit}
        elementsSelectable
        deleteKeyCode={canEdit ? "Delete" : null}
      >
        <Background gap={20} />
        <MiniMap pannable zoomable className="!bg-card" />
        <Controls />

        {canEdit && (
          <Panel position="top-left" className="!m-2">
            <Card className="p-2 flex flex-wrap gap-1.5 max-w-[260px]">
              <p className="w-full text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-1">Adicionar bloco</p>
              {BLOCK_TYPES.map((b) => (
                <Button
                  key={b.kind} size="sm" variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  style={{ borderColor: b.color, color: b.color }}
                  onClick={() => addBlock(b.kind)}
                >
                  <Plus className="h-3 w-3" /> {b.label}
                </Button>
              ))}
            </Card>
          </Panel>
        )}

        <Panel position="top-right" className="!m-2">
          <div className="flex gap-2">
            {canEdit && (
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending} className="gap-1.5">
                <Save className="h-4 w-4" /> {saveMut.isPending ? "Salvando..." : dirty ? "Salvar" : "Salvo"}
              </Button>
            )}
          </div>
        </Panel>
      </ReactFlow>

      {/* Drawer de edição */}
      <Sheet open={!!selectedNode && canEdit} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar bloco</SheetTitle>
          </SheetHeader>
          {selectedNode && (
            <div className="space-y-3 mt-4">
              <div>
                <Label>Tipo</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {BLOCK_TYPES.map((b) => {
                    const d = selectedNode.data as NodeData;
                    return (
                      <Button key={b.kind} size="sm" variant={d.kind === b.kind ? "default" : "outline"}
                        style={d.kind === b.kind ? { background: b.color, borderColor: b.color } : { borderColor: b.color, color: b.color }}
                        onClick={() => updateNode({ kind: b.kind, color: b.color })}>
                        {b.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={(selectedNode.data as NodeData).title} onChange={(e) => updateNode({ title: e.target.value })} />
              </div>
              <div>
                <Label>Mensagem sugerida</Label>
                <Textarea rows={6} value={(selectedNode.data as NodeData).message ?? ""}
                  onChange={(e) => updateNode({ message: e.target.value })} />
              </div>
              <div>
                <Label>Observações internas</Label>
                <Textarea rows={3} value={(selectedNode.data as NodeData).note ?? ""}
                  onChange={(e) => updateNode({ note: e.target.value })} />
              </div>
              <div>
                <Label>Cor (hex)</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-16 h-9 p-1" value={(selectedNode.data as NodeData).color ?? "#10b981"}
                    onChange={(e) => updateNode({ color: e.target.value })} />
                  <Input value={(selectedNode.data as NodeData).color ?? ""}
                    onChange={(e) => updateNode({ color: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                {(selectedNode.data as NodeData).message && (
                  <CopyButton text={(selectedNode.data as NodeData).message ?? ""} />
                )}
                <Button variant="destructive" size="sm" onClick={deleteSelected} className="gap-1.5 ml-auto">
                  <Trash2 className="h-4 w-4" /> Excluir bloco
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground pt-2">
                💡 Arraste de uma alça inferior para outra alça superior para conectar blocos. Duplo-clique numa conexão para editar a label (ex: "SIM", "NÃO", "Vou pensar"). Tecla Delete remove o bloco selecionado.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Visualizador read-only (apenas chama com canEdit=false)
export function FlowViewer({ flowId }: { flowId: string }) {
  return <FlowEditor flowId={flowId} canEdit={false} />;
}

void Play; // keep import for future runner toolbar
