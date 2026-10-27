import { api } from '@/api';
import type {
  AutomationTrigger, TriggerCatalogEntry,
  TriggerEventType, TriggerCategory, TriggerBindingKind,
} from './types';

const BASE = '/automation/triggers';

export async function listTriggerCatalog(): Promise<TriggerCatalogEntry[]> {
  const { data } = await api.get<{ catalog: TriggerCatalogEntry[] }>(`${BASE}/catalog`);
  return data.catalog;
}

export interface TriggerListQuery {
  eventType?: TriggerEventType;
  category?: TriggerCategory;
  enabled?: boolean;
}

export async function listTriggers(query: TriggerListQuery = {}): Promise<AutomationTrigger[]> {
  const params: Record<string, string> = {};
  if (query.eventType) params.eventType = query.eventType;
  if (query.category) params.category = query.category;
  if (query.enabled !== undefined) params.enabled = query.enabled ? 'true' : 'false';
  const { data } = await api.get<{ triggers: AutomationTrigger[] }>(BASE, { params });
  return data.triggers;
}

export async function getTrigger(id: string): Promise<AutomationTrigger> {
  const { data } = await api.get<AutomationTrigger>(`${BASE}/${id}`);
  return data;
}

export interface TriggerCreateInput {
  name: string;
  category?: TriggerCategory;
  eventType: TriggerEventType;
  eventFilter?: Record<string, unknown> | null;
  bindingKind: TriggerBindingKind;
  sequenceId?: string | null;
  blockId?: string | null;
  broadcastId?: string | null;
  segmentSpec?: Record<string, unknown> | null;
  ruleOverrides?: Record<string, unknown> | null;
  enabled?: boolean;
}

export async function createTrigger(input: TriggerCreateInput): Promise<AutomationTrigger> {
  const { data } = await api.post<AutomationTrigger>(BASE, input);
  return data;
}

export async function updateTrigger(id: string, patch: Partial<TriggerCreateInput>): Promise<AutomationTrigger> {
  const { data } = await api.put<AutomationTrigger>(`${BASE}/${id}`, patch);
  return data;
}

export async function enableTrigger(id: string): Promise<AutomationTrigger> {
  const { data } = await api.post<AutomationTrigger>(`${BASE}/${id}/enable`);
  return data;
}

export async function disableTrigger(id: string): Promise<AutomationTrigger> {
  const { data } = await api.post<AutomationTrigger>(`${BASE}/${id}/disable`);
  return data;
}

export async function deleteTrigger(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

export interface ManualRunInput {
  contactId?: string;
  segmentHint?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export async function runTrigger(id: string, input: ManualRunInput = {}): Promise<{ accepted: boolean; triggerId: string; eventType: string }> {
  const { data } = await api.post(`${BASE}/${id}/run`, input);
  return data;
}
