/** Skor "hot" ala Reddit: score / (umur_jam + 2)^1.5 */
export function hotScore(score: number, createdAt: Date | string): number {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  return score / Math.pow(ageHours + 2, 1.5);
}
