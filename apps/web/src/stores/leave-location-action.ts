export interface LeaveLocationHost {
  stopWorldLoop(): void;
}

export function leaveCurrentLocationAction(host: LeaveLocationHost): void {
  host.stopWorldLoop();
}
