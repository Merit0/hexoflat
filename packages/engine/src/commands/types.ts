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
}
