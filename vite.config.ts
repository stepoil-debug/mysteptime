// Build próprio (sem @lovable.dev/vite-tanstack-config): TanStack Start + Nitro para a Vercel.
// O app é servido dentro da Intranet em https://intranet.step-og.com/mysteptime (rewrite no
// projeto da Intranet para este projeto), por isso tudo vive sob o basepath /mysteptime.
import { defineConfig, loadEnv, type PluginOption } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

const BASE_PATH = "/mysteptime";

export default defineConfig(async ({ command, mode }) => {
  // Expõe as VITE_* no bundle do cliente (o que o plugin do Lovable fazia via `define`).
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts: wrapper de erro SSR + agendador Drake
      server: { entry: "server" },
      router: { basepath: BASE_PATH },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
  ];
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ preset: process.env.NITRO_PRESET || "vercel" }));
  }
  plugins.push(viteReact());

  return {
    base: `${BASE_PATH}/`,
    define,
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    server: { host: "::", port: 8080 },
    plugins,
  };
});
