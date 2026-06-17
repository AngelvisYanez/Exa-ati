"use client";

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 100, 200, 500] as const;

type TablePaginatorProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
};

export default function TablePaginator({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className = "",
}: TablePaginatorProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  const pageButtons = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    const rangeStart = Math.max(2, safePage - 1);
    const rangeEnd = Math.min(totalPages - 1, safePage + 1);

    if (rangeStart > 2) pages.push("ellipsis");
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < totalPages - 1) pages.push("ellipsis");
    pages.push(totalPages);

    return pages;
  };

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-brand-gray-200 bg-brand-gray-50/60 ${className}`}
    >
      <div className="flex items-center gap-2 text-xs text-brand-gray-500">
        <span className="font-medium whitespace-nowrap">
          {totalItems === 0
            ? "Sin resultados"
            : `Mostrando ${start}–${end} de ${totalItems}`}
        </span>
        <span className="text-brand-gray-300 hidden sm:inline">|</span>
        <label className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] font-bold uppercase tracking-wide text-brand-gray-400">
            Por página
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-xs font-semibold text-brand-gray-700 bg-white border border-brand-gray-200 rounded-lg px-2 py-1 outline-none focus:border-brand-navy cursor-pointer"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-brand-gray-200 bg-white text-brand-gray-600 hover:bg-brand-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Página anterior"
        >
          ‹
        </button>

        {pageButtons().map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1 text-brand-gray-400 text-xs">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`min-w-[32px] px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer
                ${p === safePage
                  ? "bg-brand-navy text-white border-brand-navy"
                  : "bg-white text-brand-gray-600 border-brand-gray-200 hover:bg-brand-gray-50"
                }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-brand-gray-200 bg-white text-brand-gray-600 hover:bg-brand-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Página siguiente"
        >
          ›
        </button>
      </div>
    </div>
  );
}
