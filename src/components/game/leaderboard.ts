import { supabase } from "./supabase";

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  duration: number;
  created_at: string;
}

export async function submitScore(
  name: string,
  score: number,
  duration: number,
): Promise<boolean> {
  const { data: existing, error: selectError } = await supabase
    .from("leaderboard")
    .select("score")
    .eq("name", name)
    .single();

  if (selectError && selectError.code !== "PGRST116") {
    throw selectError;
  }

  if (existing && score <= existing.score) {
    return false;
  }

  const { error } = await supabase
    .from("leaderboard")
    .upsert({ name, score, duration }, { onConflict: "name" });
  if (error) throw error;
  return true;
}

export async function getTopScores(
  limit = 15,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getPlayerRank(
  score: number,
): Promise<number> {
  const { count, error } = await supabase
    .from("leaderboard")
    .select("*", { count: "exact", head: true })
    .gt("score", score);
  if (error) throw error;
  return (count ?? 0) + 1;
}
