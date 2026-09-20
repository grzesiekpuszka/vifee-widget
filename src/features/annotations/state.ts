export type Tool = 'arrow' | 'rect' | 'ellipse' | 'text' | 'blur-rect' | 'blur-ellipse';
export type ColorName = 'red' | 'yellow' | 'blue' | 'black';

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

export type Shape =
  | { tool: 'arrow'; color: ColorName; from: Point; to: Point }
  | { tool: 'rect'; color: ColorName; rect: Rect }
  | { tool: 'ellipse'; color: ColorName; rect: Rect }
  | { tool: 'text'; color: ColorName; at: Point; value: string }
  | { tool: 'blur-rect'; rect: Rect }
  | { tool: 'blur-ellipse'; rect: Rect };

export interface EditorState {
  shapes: Shape[];
  undoStack: Shape[][];
  redoStack: Shape[][];
}

export const COLOR_HEX: Record<ColorName, string> = {
  red: '#dc2626',
  yellow: '#facc15',
  blue: '#2563eb',
  black: '#111827',
};

export function initialState(): EditorState {
  return { shapes: [], undoStack: [], redoStack: [] };
}

export function normalizeRect(from: Point, to: Point): Rect {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

export function commitShape(state: EditorState, shape: Shape): EditorState {
  return {
    shapes: [...state.shapes, shape],
    undoStack: [...state.undoStack, state.shapes],
    redoStack: [],
  };
}

export function undo(state: EditorState): EditorState {
  if (state.undoStack.length === 0) return state;
  const shapes = state.undoStack[state.undoStack.length - 1];
  return {
    shapes,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, state.shapes],
  };
}

export function redo(state: EditorState): EditorState {
  if (state.redoStack.length === 0) return state;
  const shapes = state.redoStack[state.redoStack.length - 1];
  return {
    shapes,
    undoStack: [...state.undoStack, state.shapes],
    redoStack: state.redoStack.slice(0, -1),
  };
}

export function clearAll(state: EditorState): EditorState {
  return {
    shapes: [],
    undoStack: [...state.undoStack, state.shapes],
    redoStack: [],
  };
}
