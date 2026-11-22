// Carrega as bibliotecas de planilha só quando necessário (fora do bundle inicial).
// Módulos CommonJS podem expor as funções em `.default` dependendo do bundler.
export const loadXLSX = async (): Promise<typeof import("xlsx")> => {
  const mod = await import("xlsx");
  return ((mod as any).default ?? mod) as typeof import("xlsx");
};
export const loadXLSXStyle = async (): Promise<typeof import("xlsx-js-style")> => {
  const mod = await import("xlsx-js-style");
  return ((mod as any).default ?? mod) as typeof import("xlsx-js-style");
};
