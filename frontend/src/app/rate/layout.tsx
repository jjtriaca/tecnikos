export default function RateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40">
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4 py-8">
        {children}
      </div>
    </div>
  );
}
