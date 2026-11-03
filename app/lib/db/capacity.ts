import "server-only";
import { getSupabase } from "./supabase";
import { DEFAULT_SETTINGS, type CapacitySettings } from "@/app/lib/capacity/model";

type SettingsRow = {
  timezone: string;
  aht_minutes: number | string;
  target_percent: number;
  target_seconds: number;
  shrinkage_percent: number;
  history_weeks: number;
  use_sample_demand: boolean;
};

// Null until migration 009 has been run; the defaults until someone saves settings
export async function getCapacitySettings(orgId: string): Promise<CapacitySettings | null> {
  const { data, error } = await getSupabase()
    .from("capacity_settings")
    .select("timezone, aht_minutes, target_percent, target_seconds, shrinkage_percent, history_weeks, use_sample_demand")
    .eq("org_id", orgId)
    .returns<SettingsRow[]>()
    .maybeSingle();

  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load capacity settings: ${error.message}`);
  if (!data) return DEFAULT_SETTINGS;

  return {
    timezone: data.timezone,
    // numeric columns come back as strings
    ahtMinutes: Number(data.aht_minutes),
    targetPercent: data.target_percent,
    targetSeconds: data.target_seconds,
    shrinkagePercent: data.shrinkage_percent,
    historyWeeks: data.history_weeks,
    useSampleDemand: data.use_sample_demand,
  };
}

export async function saveCapacitySettings(orgId: string, settings: CapacitySettings) {
  const { error } = await getSupabase().from("capacity_settings").upsert({
    org_id: orgId,
    timezone: settings.timezone,
    aht_minutes: settings.ahtMinutes,
    target_percent: settings.targetPercent,
    target_seconds: settings.targetSeconds,
    shrinkage_percent: settings.shrinkagePercent,
    history_weeks: settings.historyWeeks,
    use_sample_demand: settings.useSampleDemand,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Failed to save capacity settings: ${error.message}`);
}

// When each ticket in the last `weeks` weeks was created, for the demand forecast
export async function ticketTimes(orgId: string, weeks: number): Promise<string[]> {
  const sinceIso = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
  const times: string[] = [];
  const pageSize = 1000;

  // PostgREST returns at most 1000 rows per request, so page through
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await getSupabase()
      .from("tickets")
      .select("created_at")
      .eq("org_id", orgId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to load ticket history: ${error.message}`);
    times.push(...data.map((row) => row.created_at as string));
    if (data.length < pageSize || times.length >= 50000) break;
  }

  return times;
}
