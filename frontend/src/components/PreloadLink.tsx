import { Link, LinkProps } from 'react-router-dom';
import { preloadService } from '../services/preloadService';

interface PreloadLinkProps extends LinkProps {
  preloadOnHover?: boolean;
}

export function PreloadLink({ to, preloadOnHover = true, ...props }: PreloadLinkProps) {
  const handleMouseEnter = () => {
    const targetRoute = typeof to === 'string' ? to : '';
    if (preloadOnHover && targetRoute) {
      preloadService.preloadOnHover(targetRoute);
    }
  };

  return (
    <Link
      to={to}
      onMouseEnter={handleMouseEnter}
      {...props}
    />
  );
}

export default PreloadLink;
