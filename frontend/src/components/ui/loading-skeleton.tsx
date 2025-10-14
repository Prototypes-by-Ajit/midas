import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
}

export const BackgroundLoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ className = "absolute inset-0 -z-10" }) => {
  return (
    <div className={className}>
      <div className="animate-pulse bg-muted/20 w-full h-full" />
    </div>
  );
};

export default BackgroundLoadingSkeleton;