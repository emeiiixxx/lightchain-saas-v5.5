/** User-created edges are independent from automatic image/editor bindings. */
export type CanvasConnection = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
};

export type CanvasConnectionInput = Omit<CanvasConnection, 'id'>;
