"use server";

import { revalidatePath } from "next/cache";
import { saveSurveyRating } from "@/app/lib/db/tickets";

export interface SurveyState {
  error?: string;
  saved?: boolean;
}

// Public: anyone with the link can rate. The token is the only key, so nothing else is trusted from the form.
export async function rateTicketAction(token: string, _previous: SurveyState, formData: FormData): Promise<SurveyState> {
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose from 1 to 5 stars." };
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "This survey link isn't valid." };

  try {
    await saveSurveyRating(token, rating, comment);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save your rating." };
  }

  revalidatePath(`/rate/${token}`);
  return { saved: true };
}
