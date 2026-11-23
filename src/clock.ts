let fake: number | null = null;

export function installVirtualClock(): void {
  if (fake !== null) return;
  fake = Date.now();
  Date.now = () => fake as number;
}

export function advanceClock(ms: number): void {
  if (fake !== null) fake += ms;
}
