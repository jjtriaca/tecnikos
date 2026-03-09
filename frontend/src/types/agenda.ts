// Shared types for agenda/scheduling features

export interface AgendaOrder {
  id: string;
  code: string;
  title: string;
  status: string;
  scheduledStartAt: string;
  estimatedDurationMinutes: number | null;
  valueCents: number | null;
  addressText: string | null;
  city: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  assignedPartner: { id: string; name: string; phone: string | null } | null;
  clientPartner: { id: string; name: string } | null;
}

export interface TechnicianOption {
  id: string;
  name: string;
  phone: string | null;
}
