import { api } from '@/api';
import type { Block, BlockFolder, BlockActionType } from './types';

const BLOCKS = '/automation/blocks';
const FOLDERS = '/automation/block-folders';

// ── Blocks ─────────────────────────────────────────────────────────────────

export interface BlockListQuery {
  channel?: string;
  actionType?: BlockActionType;
  folderId?: string;
  ownerNickId?: string;
  includeArchived?: boolean;
  limit?: number;
}

export async function listBlocks(query: BlockListQuery = {}): Promise<Block[]> {
  const params: Record<string, string> = {};
  if (query.channel) params.channel = query.channel;
  if (query.actionType) params.actionType = query.actionType;
  if (query.folderId) params.folderId = query.folderId;
  if (query.ownerNickId) params.ownerNickId = query.ownerNickId;
  if (query.includeArchived) params.includeArchived = 'true';
  if (query.limit) params.limit = String(query.limit);
  const { data } = await api.get<{ blocks: Block[] }>(BLOCKS, { params });
  return data.blocks;
}

export async function getBlock(id: string): Promise<Block> {
  const { data } = await api.get<Block>(`${BLOCKS}/${id}`);
  return data;
}

export interface BlockCreateInput {
  name: string;
  channel?: string;
  actionType: BlockActionType;
  content: Record<string, unknown>;
  folderId?: string | null;
  ownerNickId?: string | null;
  isShared?: boolean;
}

export async function createBlock(input: BlockCreateInput): Promise<Block> {
  const { data } = await api.post<Block>(BLOCKS, input);
  return data;
}

export async function updateBlock(id: string, patch: Partial<BlockCreateInput>): Promise<Block> {
  const { data } = await api.put<Block>(`${BLOCKS}/${id}`, patch);
  return data;
}

export async function archiveBlock(id: string): Promise<Block> {
  const { data } = await api.post<Block>(`${BLOCKS}/${id}/archive`);
  return data;
}

export async function unarchiveBlock(id: string): Promise<Block> {
  const { data } = await api.post<Block>(`${BLOCKS}/${id}/unarchive`);
  return data;
}

export async function duplicateBlock(id: string): Promise<Block> {
  const { data } = await api.post<Block>(`${BLOCKS}/${id}/duplicate`);
  return data;
}

export async function deleteBlock(id: string): Promise<void> {
  await api.delete(`${BLOCKS}/${id}`);
}

// ── Block folders ──────────────────────────────────────────────────────────

export async function listFolders(): Promise<BlockFolder[]> {
  const { data } = await api.get<{ folders: BlockFolder[] }>(FOLDERS);
  return data.folders;
}

export interface FolderCreateInput {
  name: string;
  parentId?: string | null;
  ownerNickId?: string | null;
  ownerUserId?: string | null;
}

export async function createFolder(input: FolderCreateInput): Promise<BlockFolder> {
  const { data } = await api.post<BlockFolder>(FOLDERS, input);
  return data;
}

export async function updateFolder(id: string, patch: Partial<FolderCreateInput>): Promise<BlockFolder> {
  const { data } = await api.put<BlockFolder>(`${FOLDERS}/${id}`, patch);
  return data;
}

export async function deleteFolder(id: string, force = false): Promise<void> {
  await api.delete(`${FOLDERS}/${id}`, { params: force ? { force: 'true' } : {} });
}
