"use client";

import { use } from "react";
import { OrderForm } from "../../new/page";

export default function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <OrderForm editId={id} />;
}
