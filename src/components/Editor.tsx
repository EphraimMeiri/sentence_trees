
import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TreeNodeType, EdgeType, TreeState } from '@/types/tree';

const POS_TYPES = { N: 'NP', V: 'VP', A: 'AP', P: 'PP', Adv: 'AdvP', aux: '', Det: '' };

interface TreeNodeProps {
  node: TreeNodeType;
  selected: boolean;
  isLinking: boolean;
  onSelect: () => void;
  onUpdate: (node: TreeNodeType) => void;
  onLink: (id: number) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, selected, isLinking, onSelect, onUpdate, onLink }) => {
  const textRef = useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState(node.isLeaf ? 80 : 40);
  
  useEffect(() => {
    if (textRef.current) {
      setWidth(Math.max(node.isLeaf ? 80 : 40, textRef.current.scrollWidth + 20));
    }
  }, [node.label, node.isLeaf]);

  return (
    <g transform={`translate(${node.x},${node.y})`} className="cursor-pointer" onClick={onSelect}>
      <rect
        x={-width/2} y="-12"
        width={width} height="24"
        fill={selected ? "#e2e8f0" : isLinking ? "#fef3c7" : "white"}
        stroke={selected ? "#3b82f6" : isLinking ? "#d97706" : "none"}
        strokeWidth="2" rx="4"
      />
      <foreignObject x={-width/2} y="-12" width={width} height="24" pointerEvents="none">
        <div className="h-full flex items-center justify-center">
          <Input
            ref={textRef}
            value={node.label}
            onChange={e => onUpdate({ ...node, label: e.target.value })}
            className="w-full h-5 text-center bg-transparent border-none text-xs font-medium p-0"
            onClick={e => e.stopPropagation()}
          />
        </div>
      </foreignObject>
      {node.isLeaf && (
        <foreignObject x={-width/2} y="15" width={width} height="24" onClick={e => e.stopPropagation()}>
          <select
            value={node.pos || ''}
            onChange={e => onUpdate({ ...node, pos: e.target.value })}
            className="w-full h-6 text-xs border rounded"
          >
            <option value="">POS</option>
            {Object.keys(POS_TYPES).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </foreignObject>
      )}
      {!node.isLeaf && (
        <g transform="translate(0,18)" onClick={e => { e.stopPropagation(); onLink(node.id); }}>
          <circle r="8" fill="white" stroke="green" strokeWidth="2" />
          <ArrowDown size={10} className="transform translate-x-[-5px] translate-y-[-5px]" />
        </g>
      )}
    </g>
  );
};

interface EdgeProps {
  from: TreeNodeType;
  to: TreeNodeType;
  onDelete: () => void;
}

const Edge: React.FC<EdgeProps> = ({ from, to, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <g onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <line x1={from.x} y1={from.y + 10} x2={to.x} y2={to.y - 10} stroke="black" strokeWidth="1.5" />
      {isHovered && (
        <g transform={`translate(${(from.x + to.x)/2},${(from.y + to.y)/2})`} onClick={onDelete}>
          <circle r="8" fill="white" stroke="red" strokeWidth="2" className="cursor-pointer" />
          <X size={10} className="transform translate-x-[-5px] translate-y-[-5px] cursor-pointer" />
        </g>
      )}
    </g>
  );
};

const Editor: React.FC = () => {
  const [state, setState] = useState<TreeState>({
    sentence: '',
    nodes: [],
    edges: [],
    nextId: 1,
    selected: [],
    error: '',
    linking: null
  });
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.max(600, width - 32), height: Math.max(400, width * 0.6) });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const updatePositions = () => {
    const getChildren = (id: number) => 
      state.edges.filter(e => e.from === id).map(e => state.nodes.find(n => n.id === e.to)!);
    const getParent = (id: number) => 
      state.nodes.find(n => n.id === state.edges.find(e => e.to === id)?.from);
    
    const TOP_Y = dimensions.height * 0.125;
    const BOTTOM_Y = dimensions.height * 0.875;
    const ROOT_X = dimensions.width / 2;

    setState(prev => {
      let nodes = [...prev.nodes];
      nodes = nodes.map(node => {
        const children = getChildren(node.id);
        const parent = getParent(node.id);
        
        let x = node.x;
        let y = node.y;

        if (node.isLeaf) {
          const leafNodes = nodes.filter(n => n.isLeaf);
          const index = leafNodes.findIndex(n => n.id === node.id);
          const spacing = dimensions.width / (leafNodes.length + 1);
          x = spacing * (index + 1);
          y = BOTTOM_Y;
        } else if (node.label === 'S' && !parent) {
          x = ROOT_X;
          y = TOP_Y;
        } else if (children.length) {
          x = (Math.min(...children.map(n => n.x)) + Math.max(...children.map(n => n.x))) / 2;
          y = Math.min(...children.map(n => n.y)) - 60;
        }

        return { ...node, x, y };
      });

      return { ...prev, nodes };
    });
  };

  useEffect(() => { updatePositions(); }, [state.edges, state.nodes, dimensions]);

  const initializeNodes = () => {
    if (!state.sentence.trim()) {
      setState(prev => ({ ...prev, error: 'Please enter a sentence first' }));
      return;
    }
    const words = state.sentence.trim().split(/\s+/);
    const spacing = dimensions.width / (words.length + 1);
    
    const nodes = [
      ...words.map((word, i) => ({
        id: i + 1,
        label: word,
        pos: '',
        x: spacing * (i + 1),
        y: dimensions.height * 0.875,
        isLeaf: true,
      })),
      { 
        id: words.length + 1,
        label: 'S',
        x: dimensions.width / 2,
        y: dimensions.height * 0.125,
        isLeaf: false,
      }
    ];

    setState(prev => ({
      ...prev,
      nodes,
      nextId: words.length + 2,
      selected: [],
      edges: [],
      error: '',
    }));
  };

  const handleLink = (fromId: number) => {
    if (state.linking === fromId) {
      setState(prev => ({ ...prev, linking: null }));
    } else if (state.linking !== null) {
      setState(prev => {
        const newEdge = { id: `${state.linking}-${fromId}`, from: state.linking, to: fromId };
        return {
          ...prev,
          edges: [...prev.edges, newEdge],
          linking: null,
        };
      });
    } else {
      setState(prev => ({ ...prev, linking: fromId }));
    }
  };

  const addParent = () => {
    if (state.selected.length < 2) {
      setState(prev => ({ ...prev, error: 'Select at least 2 nodes to create a parent' }));
      return;
    }

    const selectedNodes = state.nodes.filter(n => state.selected.includes(n.id));
    const x = (Math.min(...selectedNodes.map(n => n.x)) + Math.max(...selectedNodes.map(n => n.x))) / 2;
    const y = Math.min(...selectedNodes.map(n => n.y)) - 60;

    setState(prev => ({
      ...prev,
      nodes: [...prev.nodes, { id: prev.nextId, label: 'New', x, y, isLeaf: false }],
      edges: [
        ...prev.edges,
        ...selectedNodes.map(child => ({ id: `${prev.nextId}-${child.id}`, from: prev.nextId, to: child.id }))
      ],
      nextId: prev.nextId + 1,
      selected: [],
    }));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Linguistic Tree Diagram Editor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <Input
            value={state.sentence}
            onChange={e => setState(prev => ({ ...prev, sentence: e.target.value }))}
            placeholder="Enter your sentence..."
            className="flex-grow"
          />
          <Button onClick={initializeNodes}>Create Leaf Nodes</Button>
          <Button onClick={addParent} disabled={state.selected.length < 2}>
            Add Parent ({state.selected.length})
          </Button>
        </div>
        {state.error && <div className="text-red-500 mb-4 text-sm">{state.error}</div>}
        <div className="border rounded-lg p-4" ref={containerRef}>
          <svg width={dimensions.width} height={dimensions.height} className="bg-white">
            {state.edges.map(edge => (
              <Edge
                key={edge.id}
                from={state.nodes.find(n => n.id === edge.from)!}
                to={state.nodes.find(n => n.id === edge.to)!}
                onDelete={() => setState(prev => ({
                  ...prev,
                  edges: prev.edges.filter(e => e.id !== edge.id)
                }))}
              />
            ))}
            {state.nodes.map(node => (
              <TreeNode
                key={node.id}
                node={node}
                selected={state.selected.includes(node.id)}
                isLinking={state.linking !== null}
                onSelect={() => setState(prev => ({
                  ...prev,
                  selected: prev.selected.includes(node.id)
                    ? prev.selected.filter(id => id !== node.id)
                    : [...prev.selected, node.id]
                }))}
                onUpdate={updatedNode => setState(prev => ({
                  ...prev,
                  nodes: prev.nodes.map(n => n.id === updatedNode.id ? updatedNode : n)
                }))}
                onLink={handleLink}
              />
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
};

export default Editor;