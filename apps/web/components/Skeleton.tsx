export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row" style={{ opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  );
}

export function SkeletonText({ width = "60%" }: { width?: string }) {
  return <div className="skeleton skeleton-text" style={{ width }} />;
}

export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="stat-grid" aria-hidden="true" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card">
          <SkeletonText width="50%" />
          <div className="skeleton" style={{ height: 28, width: "70%", borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}
