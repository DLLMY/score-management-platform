export const animationClasses: Record<string, string> = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  slideDown: 'animate-slide-down',
  slideLeft: 'animate-slide-left',
  slideRight: 'animate-slide-right',
  scaleIn: 'animate-scale-in',
  bounceIn: 'animate-bounce-in',
  scoreUp: 'animate-score-up',
  scoreDown: 'animate-score-down',
};

export const cssAnimations: string = `
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes scoreUp {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
    color: #10b981;
  }
  100% {
    transform: scale(1);
  }
}

@keyframes scoreDown {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
    color: #ef4444;
  }
  100% {
    transform: scale(1);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}

.animate-slide-up {
  animation: slideUp 0.4s ease-out forwards;
}

.animate-slide-down {
  animation: slideDown 0.4s ease-out forwards;
}

.animate-slide-left {
  animation: slideLeft 0.4s ease-out forwards;
}

.animate-slide-right {
  animation: slideRight 0.4s ease-out forwards;
}

.animate-scale-in {
  animation: scaleIn 0.3s ease-out forwards;
}

.animate-bounce-in {
  animation: bounceIn 0.5s ease-out forwards;
}

.animate-score-up {
  animation: scoreUp 0.5s ease-out;
}

.animate-score-down {
  animation: scoreDown 0.5s ease-out;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.list-item-enter {
  opacity: 0;
  transform: translateY(20px);
}

.list-item-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
}

.list-item-exit {
  opacity: 1;
  transform: translateY(0);
}

.list-item-exit-active {
  opacity: 0;
  transform: translateY(-20px);
  transition: opacity 0.3s ease-out, transform 0.3s ease-out;
}

.list-item-move {
  transition: transform 0.4s ease-out;
}

.score-change-up {
  animation: scoreUp 0.5s ease-out;
}

.score-change-down {
  animation: scoreDown 0.5s ease-out;
}
`;

export const getAnimationDelay = (index: number, baseDelay = 0, increment = 50): string => {
  return `${baseDelay + index * increment}ms`;
};

export const generateUniqueKey = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
