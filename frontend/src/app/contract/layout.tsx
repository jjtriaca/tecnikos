export default function ContractLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/40">
      <div className="mx-auto min-h-screen max-w-2xl px-4 py-8">
        {children}
      </div>
    </div>
  );
}
