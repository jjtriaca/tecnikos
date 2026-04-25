"use client";

import AuthLayout from "@/components/layout/AuthLayout";
import { DispatchProvider } from "@/contexts/DispatchContext";
import DispatchPanel from "@/components/os/DispatchPanel";
import TableRowSelectionListener from "@/components/TableRowSelectionListener";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DispatchProvider>
      <AuthLayout>{children}</AuthLayout>
      <DispatchPanel />
      <TableRowSelectionListener />
    </DispatchProvider>
  );
}
