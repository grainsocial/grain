type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: Readonly<{ items: BreadcrumbItem[] }>) {
  return (
    <nav className="mb-4 text-sm text-zinc-500 dark:text-zinc-300">
      {items.map((item, idx) => (
        <>
          {item.href
            ? (
              <a href={item.href} className="text-sky-500 hover:underline">
                {item.label}
              </a>
            )
            : (
              <span className="text-zinc-700 dark:text-zinc-100">
                {item.label}
              </span>
            )}
          {idx < items.length - 1 && <span className="mx-2">&gt;</span>}
        </>
      ))}
    </nav>
  );
}
