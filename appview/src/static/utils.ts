export async function copyToClipboard(link: string) {
  await navigator.clipboard.writeText(link);
  alert("Link copied to clipboard!");
}
