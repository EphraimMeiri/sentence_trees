export interface TreeNodeType {
  id: number;
  label: string;
  x: number;
  y: number;
  isLeaf: boolean;
  pos?: string;
}

export interface EdgeType {
  id: string;
  from: number;
  to: number;
}

export interface TreeState {
  sentence: string;
  nodes: TreeNodeType[];
  edges: EdgeType[];
  nextId: number;
  selected: number[];
  error: string;
  linking: number | null;
}