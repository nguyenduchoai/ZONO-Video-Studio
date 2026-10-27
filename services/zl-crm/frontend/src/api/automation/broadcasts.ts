import { api } from '@/api';

export type BroadcastState = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface BroadcastPacing {
  distributeAcrossNicks?: boolean;
  maxPerNickPerHour?: number;
  allowedHourRange?: [number, number];
  randomDelayBetweenSends?: { min: number; max: number };
}

export type SegmentSpec =
  | { kind: 'manual'; contactIds: string[] }
  | { kind: 'filter'; criteria: Record<string, unknown> }
  | { kind: 'customer-list'; listId: string };

export interface Broadcast {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  channel: string;
  blockId: string;
  segmentSpec: SegmentSpec;
  scheduleKind: 'now' | 'scheduled' | 'recurring';
  scheduledAt: string | null;
  recurringSpec: Record<string, unknown> | null;
  pacing: BroadcastPacing;
  state: BroadcastState;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; fullName: string };
  block?: { id: string; name: string; actionType: string; content: Record<string, unknown>; archivedAt: string | null } | null;
}

const BASE = '/automation/broadcasts';

export async function listBroadcasts(query: { state?: BroadcastState; channel?: string } = {}): Promise<Broadcast[]> {
  const params: Record<string, string> = {};
  if (query.state) params.state = query.state;
  if (query.channel) params.channel = query.channel;
  const { data } = await api.get<{ broadcasts: Broadcast[] }>(BASE, { params });
  return data.broadcasts;
}

export async function getBroadcast(id: string): Promise<Broadcast> {
  const { data } = await api.get<Broadcast>(`${BASE}/${id}`);
  return data;
}

export interface BroadcastCreateInput {
  name: string;
  description?: string;
  channel?: string;
  blockId: string;
  segmentSpec: SegmentSpec;
  scheduleKind?: 'now' | 'scheduled' | 'recurring';
  scheduledAt?: string;
  recurringSpec?: Record<string, unknown>;
  pacing?: BroadcastPacing;
}

export async function createBroadcast(input: BroadcastCreateInput): Promise<Broadcast> {
  const { data } = await api.post<Broadcast>(BASE, input);
  return data;
}

export async function updateBroadcast(id: string, patch: Partial<BroadcastCreateInput>): Promise<Broadcast> {
  const { data } = await api.put<Broadcast>(`${BASE}/${id}`, patch);
  return data;
}

export async function previewBroadcast(id: string): Promise<{ totalResolved: number; friendableRecipients: number; nonFriendableSkipped: number }> {
  const { data } = await api.post(`${BASE}/${id}/preview`);
  return data;
}

export async function startBroadcast(id: string): Promise<{ ok: boolean; recipientsEnqueued: number; note?: string }> {
  const { data } = await api.post(`${BASE}/${id}/start`);
  return data;
}

export async function pauseBroadcast(id: string): Promise<{ ok: boolean }> {
  const { data } = await api.post(`${BASE}/${id}/pause`);
  return data;
}

export async function resumeBroadcast(id: string): Promise<{ ok: boolean }> {
  const { data } = await api.post(`${BASE}/${id}/resume`);
  return data;
}

export async function cancelBroadcast(id: string): Promise<{ ok: boolean }> {
  const { data } = await api.post(`${BASE}/${id}/cancel`);
  return data;
}

export async function deleteBroadcast(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}
