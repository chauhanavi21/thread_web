/** Shared loading / error / empty message block. */
export function Status({ loading, error, children }) {
  if (loading) {
    return (
      <p className="py-10 text-center text-brand-500" role="status">
        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-accent-600 align-[-2px]" />
        Loading…
      </p>
    );
  }
  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>;
  if (children) return <div className="py-12 text-center text-brand-500">{children}</div>;
  return null;
}
