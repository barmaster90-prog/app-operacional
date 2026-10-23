type Downloads = { save(r: { filename: string; data: Blob }): Promise<unknown> };
type ClaudeArtifact = { use(nome: "downloads"): Promise<Downloads | null> };

/**
 * Baixa um arquivo pelo link. Na prévia do claude.ai o download direto é bloqueado,
 * então usa a permissão de download da página; no app publicado, um link temporário.
 */
export async function baixarArquivo(url: string, nome: string): Promise<void> {
  const blob = await (await fetch(url)).blob();
  const claude = (window as unknown as { claude?: ClaudeArtifact }).claude;
  const downloads = claude?.use ? await claude.use("downloads") : null;
  if (downloads) {
    await downloads.save({ filename: nome, data: blob });
    return;
  }
  const local = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = local;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(local), 1000);
}
