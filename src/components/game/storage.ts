const KEY = "pixel-runner:highscore";
const NAME_KEY = "pixel-runner:name";

export function getHighScore(): number {
  if (typeof window === "undefined") return 0;
  const v = window.localStorage.getItem(KEY);
  return v ? parseInt(v, 10) || 0 : 0;
}

export function setHighScore(score: number): number {
  if (typeof window === "undefined") return score;
  const current = getHighScore();
  if (score > current) {
    window.localStorage.setItem(KEY, String(score));
    return score;
  }
  return current;
}

export function getName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function setName(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_KEY, name);
}