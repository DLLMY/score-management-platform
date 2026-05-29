function Skeleton({ variant = 'text', className = '' }) {
  const baseStyles = 'animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded';
  
  const variantStyles = {
    text: 'h-4 w-3/4',
    title: 'h-6 w-1/2',
    paragraph: 'space-y-3',
    avatar: 'w-12 h-12 rounded-full',
    card: 'h-48 w-full rounded-xl',
    button: 'h-10 px-6 rounded-lg',
    input: 'h-12 w-full rounded-lg',
    image: 'h-40 w-full rounded-lg bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200',
    statCard: 'h-24 w-full rounded-xl',
    tableRow: 'h-12 w-full rounded-lg',
    chart: 'h-64 w-full rounded-xl'
  };

  if (variant === 'paragraph') {
    return (
      <div className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
        <div className="h-4 w-full rounded" />
        <div className="h-4 w-4/5 rounded" />
        <div className="h-4 w-3/5 rounded" />
      </div>
    );
  }

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${className}`} />
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <Skeleton variant="avatar" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="title" />
          <Skeleton variant="text" />
        </div>
      </div>
      <Skeleton variant="paragraph" />
      <div className="flex justify-end gap-2 mt-4">
        <Skeleton variant="button" className="w-20" />
        <Skeleton variant="button" className="w-20" />
      </div>
    </div>
  );
}

function ListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 p-4 bg-white rounded-xl animate-pulse">
          <Skeleton variant="avatar" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="title" />
            <Skeleton variant="text" />
          </div>
          <Skeleton variant="button" className="w-16" />
        </div>
      ))}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <Skeleton variant="avatar" className="w-10 h-10 rounded-lg" />
        <Skeleton variant="text" className="w-16" />
      </div>
      <Skeleton variant="text" className="w-3/4 h-8 mb-2" />
      <Skeleton variant="text" className="w-1/2 h-4" />
    </div>
  );
}

function TableSkeleton({ columns = 5, rows = 5 }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
      <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" className="flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function DeviceCardSkeleton() {
  return (
    <div className="bg-gradient-to-r from-gray-50 to-white rounded-lg p-3 border border-gray-100">
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton variant="text" className="w-3/4 h-3" />
          <Skeleton variant="text" className="w-1/2 h-2.5" />
        </div>
        <Skeleton variant="avatar" className="w-6 h-6 rounded-full" />
      </div>
    </div>
  );
}

function RecordItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton variant="avatar" className="w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton variant="text" className="w-3/4 h-3" />
        <Skeleton variant="text" className="w-1/2 h-2" />
      </div>
      <Skeleton variant="text" className="w-12 h-5 rounded" />
    </div>
  );
}

function CategoryCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-5 border-2 border-gray-100 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <Skeleton variant="avatar" className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="title" className="w-24 h-4" />
          <Skeleton variant="text" className="w-16 h-3" />
        </div>
      </div>
      <Skeleton variant="paragraph" />
      <div className="flex gap-2 mt-4">
        <Skeleton variant="button" className="w-16 h-8" />
        <Skeleton variant="button" className="w-16 h-8" />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton variant="title" className="w-32 mb-4" />
            <Skeleton variant="chart" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton variant="title" className="w-24 mb-3" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <DeviceCardSkeleton key={i} />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton variant="title" className="w-24 mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <RecordItemSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { 
  Skeleton, 
  CardSkeleton, 
  ListSkeleton,
  StatCardSkeleton,
  TableSkeleton,
  DeviceCardSkeleton,
  RecordItemSkeleton,
  DashboardSkeleton,
  CategoryCardSkeleton
};
export default Skeleton;