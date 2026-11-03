import { redirect } from "next/navigation";

// The original demo link: /support keeps working and opens the Atlas Ring demo chat
export default function SupportIndexPage() {
  redirect("/support/atlas-ring");
}
