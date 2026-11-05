// Whether anyone can create a new workspace. Set SIGNUP_MODE=closed in the environment for a company
// deployment: then people only join by an admin's invite. Open by default, so the demo stays usable.
export function signupOpen() {
  return (process.env.SIGNUP_MODE ?? "open").trim().toLowerCase() !== "closed";
}

export const SIGNUP_CLOSED_MESSAGE = "New workspaces are closed. Ask your company's Atlas admin to invite you.";
