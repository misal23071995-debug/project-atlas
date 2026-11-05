"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/app/lib/audit";
import { requireSession } from "@/app/lib/auth/session";
import { saveCapacitySettings } from "@/app/lib/db/capacity";

export interface SettingsFormState {
  error?: string;
  success?: string;
}

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function saveCapacitySettingsAction(
  _previous: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const { agent, org } = await requireSession("capacity.manage");
  const number = (name: string) => Number(formData.get(name));

  const timezone = String(formData.get("timezone") ?? "");
  const ahtMinutes = Math.round(number("ahtMinutes") * 10) / 10;
  const targetPercent = Math.round(number("targetPercent"));
  const targetSeconds = Math.round(number("targetSeconds"));
  const shrinkagePercent = Math.round(number("shrinkagePercent"));
  const historyWeeks = Math.round(number("historyWeeks"));

  if (!isTimeZone(timezone)) return { error: "Choose a time zone." };
  if (!(ahtMinutes > 0 && ahtMinutes <= 240)) return { error: "Handling time must be between 0.1 and 240 minutes." };
  if (!(targetPercent >= 50 && targetPercent <= 99)) return { error: "Service level must be between 50% and 99%." };
  if (!(targetSeconds >= 10 && targetSeconds <= 86400)) return { error: "Answer time must be between 10 seconds and 24 hours." };
  if (!(shrinkagePercent >= 0 && shrinkagePercent <= 60)) return { error: "Shrinkage must be between 0% and 60%." };
  if (!(historyWeeks >= 1 && historyWeeks <= 26)) return { error: "History must be between 1 and 26 weeks." };

  try {
    await saveCapacitySettings(org.id, {
      timezone,
      ahtMinutes,
      targetPercent,
      targetSeconds,
      shrinkagePercent,
      historyWeeks,
      useSampleDemand: formData.get("useSampleDemand") === "on",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save settings." };
  }

  await audit(org.id, agent, "capacity.settings_saved", null, { timezone, ahtMinutes, targetPercent, targetSeconds, shrinkagePercent, historyWeeks });
  revalidatePath("/capacity");
  return { success: "Settings saved." };
}
