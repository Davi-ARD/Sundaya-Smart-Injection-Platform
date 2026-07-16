export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={['animate-pulse rounded-md bg-slate-200/70', className].join(' ')} />
}

export function TableSkeleton({ rows = 4, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={['h-4', columnIndex === 0 ? 'w-1/3' : 'flex-1'].join(' ')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-1/2" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className="h-3 w-full" />
      ))}
    </div>
  )
}
