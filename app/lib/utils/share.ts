export async function share(
  url: string,
): Promise<{ success: boolean; method: "share" | "clipboard" }> {
  if (navigator.share) {
    try {
      await navigator.share({ url });
      return { success: true, method: "share" };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { success: false, method: "share" };
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return { success: true, method: "clipboard" };
  } catch {
    return { success: false, method: "clipboard" };
  }
}
