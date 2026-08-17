export interface Command<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload: TPayload;
}

export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload: TPayload;
}

export interface ApplyCommandResult<TState> {
  state: TState;
  events: DomainEvent[];
  /**
   * True when this command's `commandId` had already been applied, so the
   * events are the *original* outcome replayed rather than a fresh one.
   * Nothing about the state changed. Callers that mirror events onward (the
   * WS gateway, the event log) can use it to avoid double-reporting.
   */
  replayed: boolean;
}
