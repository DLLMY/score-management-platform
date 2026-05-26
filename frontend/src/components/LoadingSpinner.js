function LoadingSpinner({ size = 'md', text = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className={`border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin ${sizeClasses[size]}`} />
      {text && <span className="text-sm text-gray-500">{text}</span>}
    </div>
  );
}

export default LoadingSpinner;
