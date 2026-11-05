"use client";

import type { ReactNode } from "react";

export function RecordGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function RecordCard({
  title,
  subtitle,
  fields,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  fields?: { label: string; value: ReactNode }[];
  actions?: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-brand-gray-200 bg-white p-4">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-brand-gray-800">{title}</h3>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-brand-gray-500">{subtitle}</p> : null}
      </div>
      {fields && fields.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-[10px] font-semibold tracking-wide text-brand-gray-400 uppercase">{field.label}</dt>
              <dd className="truncate text-xs text-brand-gray-700">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions ? <div className="mt-auto flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
