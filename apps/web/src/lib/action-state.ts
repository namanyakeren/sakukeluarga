export interface ActionState {
  ok: boolean;
  error?: string;
  ts?: number;
}

export const initialActionState: ActionState = { ok: false };
