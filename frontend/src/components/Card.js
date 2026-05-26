function Card({ children, title, icon: Icon, className = '', headerClass = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      {title && (
        <div className={`px-6 py-4 bg-gray-50 border-b border-gray-100 ${headerClass}`}>
          {Icon && (
            <div className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">{title}</h3>
            </div>
          )}
          {!Icon && <h3 className="font-semibold text-gray-900">{title}</h3>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

export default Card;
