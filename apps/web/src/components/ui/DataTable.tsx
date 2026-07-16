import type { ReactNode } from 'react'

export type Column<T> = {
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'Belum ada data.',
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
}) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200/70 text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            {columns.map((column) => (
              <th key={column.header} className="py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors duration-150 hover:bg-slate-50/80">
              {columns.map((column) => (
                <td key={column.header} className={['py-3.5 pr-4', column.className].filter(Boolean).join(' ')}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
