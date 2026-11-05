export interface ActionState {
  ok: boolean;
  error?: string;
  message?: string;
  ts?: number;
}

export const initialActionState: ActionState = { ok: false };
