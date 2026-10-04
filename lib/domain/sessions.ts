/** Pure: which sessions still happen. A cancelled session keeps its row (history, payroll) but leaves every roster view. */
export const isLive = (s: { cancelledAt: Date | null }): boolean => !s.cancelledAt;
export function liveSessions<T extends { cancelledAt: Date | null }>(rows: readonly T[]): T[] {
  return rows.filter(isLive);
}
