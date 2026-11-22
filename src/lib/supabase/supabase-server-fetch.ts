/** Fetch server-only compatível com o runtime do servidor (Vercel). */
import "@tanstack/react-start/server-only";

export const supabaseServerFetch: typeof globalThis.fetch = (input, init) =>
  globalThis.fetch(input, init);
