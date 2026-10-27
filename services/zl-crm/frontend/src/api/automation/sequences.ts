import { api } from '@/api';
import type { AutomationSequence, SequenceStep, SequenceRuntimeRules } from './types';

const BASE = '/automation/sequences';

export interface SequenceListQuery {
  channel?: string;
  enabled?: boolean;
}

export async function listSequences(query: SequenceListQuery = {}): Promise<AutomationSequence[]> {
  const params: Record<string, string> = {};
  if (query.channel) params.channel = query.channel;
  if (query.enabled !== undefined) params.enabled = query.enabled ? 'true' : 'false';
  const { data } = await api.get<{ sequences: AutomationSequence[] }>(BASE, { params });
  return data.sequences;
}

export async function getSequence(id: string): Promise<AutomationSequence> {
  const { data } = await api.get<AutomationSequence>(`${BASE}/${id}`);
  return data;
}

export interface SequenceCreateInput {
  name: string;
  description?: string;
  channel?: string;
  steps: SequenceStep[];
  runtimeRules?: SequenceRuntimeRules;
  enabled?: boolean;
}

export async function createSequence(input: SequenceCreateInput): Promise<AutomationSequence> {
  const { data } = await api.post<AutomationSequence>(BASE, input);
  return data;
}

export async function updateSequence(id: string, patch: Partial<SequenceCreateInput>): Promise<AutomationSequence> {
  const { data } = await api.put<AutomationSequence>(`${BASE}/${id}`, patch);
  return data;
}

export async function enableSequence(id: string): Promise<AutomationSequence> {
  const { data } = await api.post<AutomationSequence>(`${BASE}/${id}/enable`);
  return data;
}

export async function disableSequence(id: string): Promise<AutomationSequence> {
  const { data } = await api.post<AutomationSequence>(`${BASE}/${id}/disable`);
  return data;
}

export async function duplicateSequence(id: string): Promise<AutomationSequence> {
  const { data } = await api.post<AutomationSequence>(`${BASE}/${id}/duplicate`);
  return data;
}

export async function deleteSequence(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}
