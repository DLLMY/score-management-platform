function Skeleton({ variant = 'text', className = '' }) {
  const baseStyles = 'animate-pulse bg-gray-200 rounded';
  
  const variantStyles = {
    text: 'h-4 w-3/4',
    title: 'h-6 w-1/2',
    paragraph: 'space-y-3',
    avatar: 'w-12 h-12 rounded-full',
    card: 'h-48 w-full rounded-xl',
    button: 'h-10 px-6 rounded-lg',
    input: 'h-12 w-full rounded-lg',
    image: 'h-40 w-full rounded-lg bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200'
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

export { Skeleton, CardSkeleton, ListSkeleton };
export default Skeleton;