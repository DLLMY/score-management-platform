import { useState, useEffect, useRef, memo } from 'react';

interface AnimatedScoreProps {
  score?: number;
  value?: number;
  className?: string;
}

function AnimatedScore({ score, value, className = '' }: AnimatedScoreProps) {
  const resolvedScore = value ?? score ?? 0;
  const [displayScore, setDisplayScore] = useState<number>(resolvedScore);
  const previousScore = useRef<number>(resolvedScore);

  useEffect(() => {
    if (previousScore.current !== resolvedScore) {
      const startScore = previousScore.current;
      const endScore = resolvedScore;
      const duration = 400;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentScore = Math.round(startScore + (endScore - startScore) * easeOutQuart);

        setDisplayScore(currentScore);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayScore(endScore);
        }
      };

      requestAnimationFrame(animate);
      previousScore.current = resolvedScore;
    }
  }, [resolvedScore]);

  const getScoreColor = (): string => {
    if (displayScore >= 80) return 'text-green-600';
    if (displayScore >= 60) return 'text-blue-600';
    return 'text-red-600';
  };

  return (
    <span className={`text-lg font-bold ${getScoreColor()} ${className}`}>{displayScore}</span>
  );
}

export default memo(AnimatedScore);