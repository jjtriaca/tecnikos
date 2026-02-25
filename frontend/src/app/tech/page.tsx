"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TechRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/tech/orders");
  }, [router]);
  return null;
}
