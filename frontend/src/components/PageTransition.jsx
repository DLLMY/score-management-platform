import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function PageTransition({ children }) {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  const prevLocation = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prevLocation.current) return;
    
    setIsAnimating(true);
    
    const timer = setTimeout(() => {
      prevLocation.current = location.pathname;
      setIsAnimating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className={`relative transition-all duration-300 ease-out ${
      isAnimating 
        ? 'opacity-0 translate-y-2 scale-[0.99]' 
        : 'opacity-100 translate-y-0 scale-100'
    }`}>
      {children}
    </div>
  );
}

export default PageTransition;
