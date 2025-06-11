export function LabelDefinitionButton(
  { src, val }: Readonly<{ src: string; val: string }>,
) {
  return (
    <button
      type="button"
      class="text-sky-500 hover:underline cursor-pointer"
      hx-get={`/dialogs/label/${src}/${val}`}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      _="on click halt"
    >
      Learn more
    </button>
  );
}
