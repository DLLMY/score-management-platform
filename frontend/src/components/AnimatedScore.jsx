import { useState, useEffect, useRef } from 'react';

function AnimatedScore({ score, className = '' }) {
  const [displayScore, setDisplayScore] = useState(score);
  const previousScore = useRef(score);

  useEffect(() => {
    if (previousScore.current !== score) {
      const startScore = previousScore.current;
      const endScore = score;
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
      previousScore.current = score;
    }
  }, [score]);

  const getScoreColor = () => {
    if (displayScore >= 80) return 'text-green-600';
    if (displayScore >= 60) return 'text-blue-600';
    return 'text-red-600';
  };

  return (
    <span className={`text-lg font-bold ${getScoreColor()} ${className}`}>
      {displayScore}
    </span>
  );
}

export default AnimatedScore;
