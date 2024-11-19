import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { TreeNodeType, EdgeType, TreeState } from '@/types/tree';


interface TreeNodeType {
  id: number;
  label: string;
  x: number;
  y: number;
  isLeaf: boolean;
  pos?: string;
  projectedParent?: number | null;
}

interface EdgeControlPoint {
  x: number;
  y: number;
}

interface EdgeType {
  id: string;
  from: number;
  to: number;
  controlPoint?: EdgeControlPoint;   // Add this to your type
}
interface TreeState {
  sentence: string;
  nodes: TreeNodeType[];
  edges: EdgeType[];
  nextId: number;
  selected: number[];
  error: string;
  linking: number | null;
}
// Separate projecting and non-projecting POS types
const PROJECTING_POS = { N: 'NP', V: 'VP', A: 'AP', P: 'PP', Adv: 'AdvP' };
const NON_PROJECTING_POS = ['aux', 'Det','PNP'];
const POS_TYPES = { ...PROJECTING_POS, aux: '', Det: '' };

interface TreeNodeProps {
  node: TreeNodeType;
  selected: boolean;
  isLinking: boolean;
  dimensions: { width: number; height: number };
  totalLeafNodes: number; 
  onSelect: () => void;
  onUpdate: (node: TreeNodeType) => void;
  onLink: (id: number) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, selected, isLinking, dimensions, totalLeafNodes, onSelect, onUpdate, onLink }) => {
  const textRef = useRef<HTMLInputElement>(null);
  // const [width, setWidth] = useState(node.isLeaf ? 80 : 40);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const handleDragStart = (e: React.MouseEvent) => {
    if (isLinking) return; // Don't start drag if we're in linking mode
    setIsDragging(true);
    setDragStart({ 
      x: e.clientX - node.x, 
      y: e.clientY - node.y 
    });
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    onUpdate({
      ...node,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag as any);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDrag as any);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging]);
  // Calculate spacing between nodes
  const spacing = dimensions.width / (totalLeafNodes + 1);
  // Make box width smaller than spacing to prevent overlap
  const baseWidth = spacing * 0.8;  // Use 80% of available space
  
  // Calculate dynamic font size based on available width
  const fontSize = Math.min(14, Math.max(11, Math.floor(baseWidth / 10))); // between 11px and 14px
  
  const [width, setWidth] = useState(node.isLeaf ? baseWidth : baseWidth * 0.6);
  
  useEffect(() => {
    if (textRef.current) {
      const minWidth = node.isLeaf ? baseWidth : baseWidth * 0.6;
      // Add padding proportional to the base width
      setWidth(Math.max(minWidth, textRef.current.scrollWidth + (baseWidth * 0.1)));
    }
  }, [node.label, node.isLeaf, baseWidth]);

  return (
    <g transform={`translate(${node.x},${node.y})`} className="cursor-move" onClick={isLinking ? onLink.bind(null, node.id) : onSelect} onMouseDown={handleDragStart}>
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
            style={{ fontSize: `${fontSize}px` }}  // Dynamic font size
            className="w-full h-5 text-center bg-transparent border-none font-medium p-0"
            onClick={e => e.stopPropagation()}
          />
        </div>
      </foreignObject>
      {node.isLeaf && (
        <foreignObject x={-width/2} y="15" width={width} height="24" onClick={e => e.stopPropagation()}>
          <select
            value={node.pos || ''}
            onChange={e => onUpdate({ ...node, pos: e.target.value })}
            style={{ fontSize: `${fontSize}px` }}  // Match font size for POS selector
            className="w-full h-6 border rounded"
          >
            <option value="">POS</option>
            {[...NON_PROJECTING_POS, ...Object.keys(PROJECTING_POS)].map(p => (
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
  edge: EdgeType; 
  onUpdate: (edge: EdgeType) => void; 
  onDelete: () => void;
}

const Edge: React.FC<EdgeProps> = ({ from, to, edge, onDelete, onUpdate }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGGElement>(null);

  // Default control point is midway between start and end
  const defaultControlPoint: EdgeControlPoint = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2
  };

  const controlPoint = edge.controlPoint || defaultControlPoint;

  const handleControlPointDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleControlPointDrag = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const svgElement = svgRef.current?.closest('svg');
    if (!svgElement) return;
    
    const svgRect = svgElement.getBoundingClientRect();
    const newControlPoint = {
      x: e.clientX - svgRect.left,
      y: e.clientY - svgRect.top
    };
    
    onUpdate({ ...edge, controlPoint: newControlPoint });
  };

  const handleControlPointDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleControlPointDrag);
      window.addEventListener('mouseup', handleControlPointDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleControlPointDrag);
        window.removeEventListener('mouseup', handleControlPointDragEnd);
      };
    }
  }, [isDragging]);

  // Create quadratic curve path
  const pathD = `M ${from.x},${from.y + 10} ` +
                `Q ${controlPoint.x},${controlPoint.y} ` +
                `${to.x},${to.y - 10}`;

  return (
    <g ref={svgRef} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <path 
        d={pathD} 
        stroke="black" 
        strokeWidth="1.5" 
        fill="none" 
      />
      {isHovered && (
        <>
          {/* Single draggable control point */}
          <g 
            transform={`translate(${controlPoint.x},${controlPoint.y})`}
            onMouseDown={handleControlPointDragStart}
            className="cursor-move"
          >
            <circle r="4" fill="blue" stroke="white" strokeWidth="2" />
          </g>
          {/* Delete button */}
          <g transform={`translate(${(from.x + to.x)/2},${(from.y + to.y)/2})`} onClick={onDelete}>
            <circle r="8" fill="white" stroke="red" strokeWidth="2" className="cursor-pointer" />
            <X size={10} className="transform translate-x-[-5px] translate-y-[-5px] cursor-pointer" />
          </g>
        </>
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
        // Make height proportional to width but taller
        setDimensions({ 
          width: Math.max(600, width - 32), 
          height: Math.max(800, width * 0.8) // Increased from 0.6 to 0.8 or higher
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    // const getChildren = (id: number) => 
    //   state.edges.filter(e => e.from === id).map(e => state.nodes.find(n => n.id === e.to)!);
    // const getParent = (id: number) => 
    //   state.nodes.find(n => n.id === state.edges.find(e => e.to === id)?.from);
    
    // const TOP_Y = dimensions.height * 0.125;
    // const BOTTOM_Y = dimensions.height * 0.875;
    // const ROOT_X = dimensions.width / 2;
  
    const updatePositions = () => {
      const getChildren = (id: number) => 
        state.edges.filter(e => e.from === id).map(e => state.nodes.find(n => n.id === e.to)!);
      const getParent = (id: number) => 
        state.nodes.find(n => n.id === state.edges.find(e => e.to === id)?.from);
      
      // Calculate tree depth to adjust spacing
      const calculateDepth = (nodeId: number, visited = new Set<number>()): number => {
        if (visited.has(nodeId)) return 0;
        visited.add(nodeId);
        const children = getChildren(nodeId);
        if (!children.length) return 0;
        return 1 + Math.max(...children.map(child => calculateDepth(child.id, visited)));
      };
  
      // Find root node (S)
      const rootNode = state.nodes.find(n => n.label === 'S' && !getParent(n.id));
      const treeDepth = rootNode ? calculateDepth(rootNode.id) + 1 : 1;
  
      // Adjust vertical spacing based on tree depth
      const VERTICAL_GAP = dimensions.height * 0.1; // Increased from 0.15
      const TOP_Y = dimensions.height * 0.1;  // Adjust as needed
      const BOTTOM_Y = dimensions.height * 0.8; // Adjust as needed
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
            // Position S relative to highest non-S node
            const highestY = Math.min(...nodes
              .filter(n => n.id !== node.id)
              .map(n => n.y));
            y = Math.min(TOP_Y, highestY - VERTICAL_GAP);
          } else if (children.length) {
            x = (Math.min(...children.map(n => n.x)) + Math.max(...children.map(n => n.x))) / 2;
            y = Math.min(...children.map(n => n.y)) - VERTICAL_GAP;
          }
  
          return { ...node, x, y };
        });
  
        return { ...prev, nodes };
      });
    };
  
    updatePositions();
  }, [dimensions.width, dimensions.height, state.edges.length]); // Only depend on these specific values
  


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
        projectedParent: null,
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

  const handleNodeUpdate = (updatedNode: TreeNodeType) => {
    setState(prev => {
      let newState = { ...prev };
      const oldNode = prev.nodes.find(n => n.id === updatedNode.id)!;
      
      // Handle POS changes for leaf nodes
      if (updatedNode.isLeaf && oldNode.pos !== updatedNode.pos) {
        // Remove old projection if it exists
        if (oldNode.projectedParent) {
          newState.nodes = newState.nodes.filter(n => n.id !== oldNode.projectedParent);
          newState.edges = newState.edges.filter(e => e.from !== oldNode.projectedParent);
        }

        // Add new projection if needed
        if (PROJECTING_POS[updatedNode.pos as keyof typeof PROJECTING_POS]) {
          const projectedParent = {
            id: prev.nextId,
            label: PROJECTING_POS[updatedNode.pos as keyof typeof PROJECTING_POS],
            x: updatedNode.x,
            y: updatedNode.y - 60,
            isLeaf: false,
          };

          newState.nodes = [...newState.nodes, projectedParent];
          newState.edges = [...newState.edges, {
            id: `${prev.nextId}-${updatedNode.id}`,
            from: prev.nextId,
            to: updatedNode.id
          }];
          updatedNode.projectedParent = prev.nextId;
          newState.nextId = prev.nextId + 1;
        }
      }

      // Update the node itself
      newState.nodes = newState.nodes.map(n => 
        n.id === updatedNode.id ? updatedNode : n
      );

      return newState;
    });
  };

  const handleLink = (fromId: number) => {
    if (state.linking === fromId) {
      setState(prev => ({ ...prev, linking: null }));
    } else if (state.linking !== null) {
      setState(prev => ({
        ...prev,
        edges: [...prev.edges, { 
          id: `${prev.linking}-${fromId}`, 
          from: prev.linking!, 
          to: fromId 
        }],
        linking: null,
      }));
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
  const totalLeafNodes = state.nodes.filter(n => n.isLeaf).length;

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
          <svg width={dimensions.width} height={dimensions.height} className="bg-white"
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} 
              preserveAspectRatio="xMidYMid meet" 
          >
          {state.edges.map(edge => (
            <Edge
              key={edge.id}
              edge={edge}  // Add this
              from={state.nodes.find(n => n.id === edge.from)!}
              to={state.nodes.find(n => n.id === edge.to)!}
              onDelete={() => setState(prev => ({
                ...prev,
                edges: prev.edges.filter(e => e.id !== edge.id)
              }))}
              onUpdate={(updatedEdge) => setState(prev => ({
                ...prev,
                edges: prev.edges.map(e => e.id === updatedEdge.id ? updatedEdge : e)
              }))}
            />
          ))}
        {state.nodes.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            dimensions={dimensions}
            totalLeafNodes={totalLeafNodes}  // Add this
            selected={state.selected.includes(node.id)}
            isLinking={state.linking !== null}
            onSelect={() => setState(prev => ({
              ...prev,
              selected: prev.selected.includes(node.id)
                ? prev.selected.filter(id => id !== node.id)
                : [...prev.selected, node.id]
            }))}
            onUpdate={handleNodeUpdate}
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