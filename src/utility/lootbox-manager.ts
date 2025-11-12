import { ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { randomUUID } from "crypto";
import { logger } from "../logger";
import {
  LootBoxInventoryItem,
  LootBoxInventoryView,
  LootBoxItem,
  LootBoxOverlaySettings,
  LootBoxProps,
  LootBoxRecord,
  LootBoxSelection,
  LootBoxSourceType,
} from "../types/types";
import {
  emitLootBoxOpened,
  emitLootBoxItemWon,
  emitLootBoxEmpty,
  emitLootBoxItemDepleted,
} from "../events/lootbox-events";

const path = require("path");
const fs = require("fs");

const ROOT_KEY = "/lootboxes";
const PENDING_SELECTION_TTL_MS = 5 * 60 * 1000;

const sanitizeIdentifier = (value: string): string => {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return trimmed
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const sanitizeLootBoxId = (value: string): string => sanitizeIdentifier(value);
const sanitizeItemId = (value: string): string => sanitizeIdentifier(value);

const toNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const nowIso = (): string => new Date().toISOString();

const cloneInventoryItem = (item: LootBoxInventoryItem): LootBoxInventoryItem => ({
  ...item,
});

const toInventoryView = (item: LootBoxInventoryItem): LootBoxInventoryView => ({
  ...cloneInventoryItem(item),
  remaining: item.maxWins === null ? null : Math.max(0, item.maxWins - item.wins),
});

export const DEFAULT_LOOTBOX_PROPS: LootBoxProps = {
  backgroundGradientStart: "#090e36",
  backgroundGradientEnd: "#2a0c41",
  hideBackground: false,
  glowColor: "#ff9f5a",
  accentColor: "#ff54d7",
  textColor: "#ffffff",
  subtitleColor: "#ffa94d",
  valueColor: "#ffe8a3",
  fontFamily: "'Montserrat', sans-serif",
  revealDelayMs: 2200,
  revealHoldMs: 5200,
  showConfetti: true,
  items: [],
};

export const DEFAULT_OVERLAY_SETTINGS: LootBoxOverlaySettings = {
  lengthSeconds: 15,
  durationMs: 2200,
  overlayInstance: undefined,
};

const weightedSelect = (items: LootBoxInventoryItem[]): LootBoxInventoryItem | undefined => {
  const valid = items.filter((item) => {
    if (!item) {
      return false;
    }
    const weight = Number(item.weight) || 0;
    if (weight <= 0) {
      return false;
    }
    if (item.maxWins === null) {
      return true;
    }
    return item.wins < item.maxWins;
  });

  if (!valid.length) {
    return undefined;
  }

  const total = valid.reduce((sum, current) => sum + (Number(current.weight) || 1), 0);
  let ticket = Math.random() * total;
  for (const item of valid) {
    ticket -= Number(item.weight) || 1;
    if (ticket <= 0) {
      return item;
    }
  }

  return valid[valid.length - 1];
};

export class LootBoxManager {
  private readonly _db: any;
  private readonly _modules: ScriptModules;
  private readonly _pendingSelections = new Map<string, LootBoxSelection>();

  constructor(dbPath: string, modules: ScriptModules) {
    this._modules = modules;
    const directory = modules?.path?.dirname ? modules.path.dirname(dbPath) : path.dirname(dbPath);

    try {
      fs.mkdirSync(directory, { recursive: true });
    } catch (error) {
      logger.warn("LootBoxManager: unable to ensure database directory", error);
    }

    try {
      // @ts-ignore
      this._db = new modules.JsonDb(dbPath, true, true);
    } catch (error) {
      logger.error("LootBoxManager: failed to initialise database", error);
      throw error;
    }

    void this.ensureRoot();
  }

  private async ensureRoot(): Promise<void> {
    try {
      await this._db.getData(ROOT_KEY);
    } catch {
      await this._db.push(ROOT_KEY, {}, true);
    }
  }

  private cleanupPendingSelections(): void {
    if (!this._pendingSelections.size) {
      return;
    }
    const cutoff = Date.now() - PENDING_SELECTION_TTL_MS;
    for (const [key, selection] of this._pendingSelections.entries()) {
      if (new Date(selection.timestamp).getTime() < cutoff) {
        this._pendingSelections.delete(key);
      }
    }
  }

  private findExistingItemId(record: LootBoxRecord | undefined, incoming: LootBoxItem): string | undefined {
    if (!record) {
      return undefined;
    }

    const explicitId = sanitizeItemId(String(incoming.id ?? ""));
    if (explicitId && record.items[explicitId]) {
      return explicitId;
    }

    const label = (incoming.label ?? "").trim().toLowerCase();
    const value = (incoming.value ?? "").trim().toLowerCase();

    const matched = Object.values(record.items).find((existing) => {
      const existingLabel = (existing.label ?? "").trim().toLowerCase();
      const existingValue = (existing.value ?? "").trim().toLowerCase();
      return existingLabel === label && existingValue === value;
    });

    return matched?.id;
  }

  private async ensureLootBoxRecord(
    lootBoxId: string,
    overrides?: Partial<Pick<LootBoxRecord, "displayName" | "props" | "overlaySettings" | "source">>
  ): Promise<LootBoxRecord> {
    const existing = await this.getLootBox(lootBoxId);
    if (existing) {
      return existing;
    }

    const now = nowIso();
    const record: LootBoxRecord = {
      id: lootBoxId,
      displayName: overrides?.displayName || lootBoxId,
      source: overrides?.source || "manager",
      props: {
        ...DEFAULT_LOOTBOX_PROPS,
        ...(overrides?.props || {}),
        items: [],
      },
      items: {},
      createdAt: now,
      updatedAt: now,
      totalOpens: 0,
      overlaySettings: overrides?.overlaySettings || { ...DEFAULT_OVERLAY_SETTINGS },
    };

    await this.writeRecord(record);
    return record;
  }

  private generateItemId(record: LootBoxRecord | undefined, incoming: LootBoxItem): string {
    const existingId = this.findExistingItemId(record, incoming);
    if (existingId) {
      return existingId;
    }

    const provided = sanitizeItemId(String(incoming.id ?? ""));
    if (provided && !record?.items[provided]) {
      return provided;
    }

    const baseAttempt = sanitizeItemId(incoming.label || incoming.value || "");
    const base = baseAttempt || `item-${randomUUID()}`;

    if (!record) {
      return base;
    }

    let candidate = base;
    let counter = 1;
    while (record.items[candidate]) {
      candidate = `${base}-${counter++}`;
    }

    return candidate;
  }

  private normalizeMaxWins(value: unknown): number | null {
    const numeric = toNumber(value);
    if (numeric === undefined) {
      return null;
    }
    if (numeric < 0) {
      return null;
    }
    return Math.floor(numeric);
  }

  private normalizeWeight(value: unknown, fallback?: number): number {
    const numeric = toNumber(value);
    if (numeric !== undefined && numeric > 0) {
      return numeric;
    }
    if (fallback && fallback > 0) {
      return fallback;
    }
    return 1;
  }

  private computeRemaining(item: LootBoxInventoryItem): number | null {
    if (item.maxWins === null) {
      return null;
    }
    return Math.max(0, item.maxWins - item.wins);
  }

  private async writeRecord(record: LootBoxRecord): Promise<void> {
    await this.ensureRoot();
    await this._db.push(`${ROOT_KEY}/${record.id}`, record, true);
  }

  async listLootBoxes(): Promise<LootBoxRecord[]> {
    await this.ensureRoot();
    try {
      const data = await this._db.getData(ROOT_KEY);
      if (!data || typeof data !== "object") {
        return [];
      }
      return Object.values(data) as LootBoxRecord[];
    } catch {
      return [];
    }
  }

  async getLootBox(rawId: string): Promise<LootBoxRecord | undefined> {
    const id = sanitizeLootBoxId(rawId);
    if (!id) {
      return undefined;
    }
    await this.ensureRoot();
    try {
      const record = await this._db.getData(`${ROOT_KEY}/${id}`);
      return record as LootBoxRecord;
    } catch {
      return undefined;
    }
  }

  async syncLootBox(options: {
    id: string;
    displayName?: string;
    source: LootBoxSourceType;
    props: LootBoxProps;
    items: LootBoxItem[];
    overlaySettings?: LootBoxOverlaySettings;
  }): Promise<LootBoxRecord> {
    const lootBoxId = sanitizeLootBoxId(options.id);
    if (!lootBoxId) {
      throw new Error("LootBoxManager: loot box ID is required and must contain letters or numbers.");
    }

    const now = nowIso();
    const existing = await this.getLootBox(lootBoxId);
    const items = existing ? { ...existing.items } : {};

    const incomingItems = options.items || [];
    const seenIds = new Set<string>();

    for (const incoming of incomingItems) {
      if (!incoming) {
        continue;
      }

      const itemId = this.generateItemId(existing, incoming);
      seenIds.add(itemId);
      const current = items[itemId];

      const normalizedMaxWins = this.normalizeMaxWins(incoming.maxWins);
      const wins = current?.wins ?? 0;
      const adjustedWins =
        normalizedMaxWins === null ? wins : Math.min(wins, normalizedMaxWins);

      const updated: LootBoxInventoryItem = {
        id: itemId,
        label: (incoming.label ?? current?.label ?? "").trim(),
        value: incoming.value ?? current?.value ?? "",
        subtitle: incoming.subtitle ?? current?.subtitle,
        weight: this.normalizeWeight(incoming.weight, current?.weight),
        maxWins: normalizedMaxWins,
        wins: adjustedWins,
        lastWonAt: current?.lastWonAt,
        imageMode: incoming.imageMode ?? current?.imageMode,
        imageUrl: incoming.imageUrl ?? current?.imageUrl,
        imageFile: incoming.imageFile ?? current?.imageFile,
        accentColor: incoming.accentColor ?? current?.accentColor,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };

      items[itemId] = updated;
    }

    const record: LootBoxRecord = {
      id: lootBoxId,
      displayName: options.displayName || existing?.displayName || lootBoxId,
      source: options.source ?? existing?.source ?? "list",
      props: {
        ...options.props,
        items: [],
      },
      items,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastOpenedAt: existing?.lastOpenedAt,
      lastSelectedItemId: existing?.lastSelectedItemId,
      totalOpens: existing?.totalOpens ?? 0,
      overlaySettings: options.overlaySettings ?? existing?.overlaySettings,
    };

    if (existing) {
      for (const [itemId, item] of Object.entries(existing.items)) {
        if (!seenIds.has(itemId)) {
          items[itemId] = item;
        }
      }
    }

    await this.writeRecord(record);
    return record;
  }

  async addItem(lootBoxId: string, item: LootBoxItem): Promise<LootBoxInventoryItem> {
    const record = await this.ensureLootBoxRecord(lootBoxId);

    const now = nowIso();
    const itemId = this.generateItemId(record, item);
    const maxWins = this.normalizeMaxWins(item.maxWins);

    const newItem: LootBoxInventoryItem = {
      id: itemId,
      label: (item.label ?? "").trim() || `Item ${Object.keys(record.items).length + 1}`,
      value: item.value ?? "",
      subtitle: item.subtitle,
      weight: this.normalizeWeight(item.weight),
      maxWins,
      wins: 0,
      lastWonAt: undefined,
      imageMode: item.imageMode,
      imageUrl: item.imageUrl,
      imageFile: item.imageFile,
      accentColor: item.accentColor,
      createdAt: now,
      updatedAt: now,
    };

    record.items[itemId] = newItem;
    record.updatedAt = now;

    await this.writeRecord(record);
    return newItem;
  }

  async removeItem(lootBoxId: string, itemId: string): Promise<boolean> {
    const record = await this.getLootBox(lootBoxId);
    if (!record) {
      return false;
    }

    const sanitizedId = sanitizeItemId(itemId);
    if (!sanitizedId || !record.items[sanitizedId]) {
      return false;
    }

    delete record.items[sanitizedId];

    if (record.lastSelectedItemId === sanitizedId) {
      record.lastSelectedItemId = undefined;
    }

    record.updatedAt = nowIso();
    await this.writeRecord(record);
    return true;
  }

  async updateItem(lootBoxId: string, itemId: string, updates: Partial<LootBoxItem>): Promise<LootBoxInventoryItem | undefined> {
    const record = await this.getLootBox(lootBoxId);
    if (!record) {
      return undefined;
    }

    const sanitizedId = sanitizeItemId(itemId);
    const current = record.items[sanitizedId];
    if (!current) {
      return undefined;
    }

    const now = nowIso();
    const maxWinsInput = updates.maxWins !== undefined ? updates.maxWins : current.maxWins;
    const maxWins = this.normalizeMaxWins(maxWinsInput);

    const requestedWinsRaw =
      updates.wins !== undefined ? toNumber(updates.wins) ?? 0 : current.wins;
    const requestedWins = Math.max(0, Math.floor(requestedWinsRaw));

    const wins =
      maxWins === null
        ? requestedWins
        : Math.min(requestedWins, maxWins);

    const updated: LootBoxInventoryItem = {
      ...current,
      label: updates.label !== undefined ? (updates.label ?? "").trim() : current.label,
      value: updates.value !== undefined ? updates.value ?? "" : current.value,
      subtitle: updates.subtitle !== undefined ? updates.subtitle : current.subtitle,
      weight: this.normalizeWeight(updates.weight ?? current.weight, current.weight),
      maxWins,
      wins,
      imageMode: updates.imageMode !== undefined ? updates.imageMode : current.imageMode,
      imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : current.imageUrl,
      imageFile: updates.imageFile !== undefined ? updates.imageFile : current.imageFile,
      accentColor: updates.accentColor !== undefined ? updates.accentColor : current.accentColor,
      lastWonAt: updates.lastWonAt !== undefined ? updates.lastWonAt : current.lastWonAt,
      updatedAt: now,
    };

    record.items[sanitizedId] = updated;
    record.updatedAt = now;
    await this.writeRecord(record);
    return updated;
  }

  async setItemMaxWins(lootBoxId: string, itemId: string, maxWins: number | null): Promise<LootBoxInventoryItem | undefined> {
    return this.updateItem(lootBoxId, itemId, { maxWins });
  }

  async adjustItemRemaining(lootBoxId: string, itemId: string, delta: number): Promise<LootBoxInventoryItem | undefined> {
    const record = await this.getLootBox(lootBoxId);
    if (!record) {
      return undefined;
    }

    const sanitizedId = sanitizeItemId(itemId);
    const current = record.items[sanitizedId];
    if (!current) {
      return undefined;
    }

    if (current.maxWins === null) {
      logger.warn(`Cannot adjust stock for item "${current.label}" - it has unlimited stock. Set a Max Wins value first.`);
      return current;
    }

    const remaining = this.computeRemaining(current);
    const newRemaining = Math.max(0, (remaining ?? 0) + delta);
    const newMaxWins = current.wins + newRemaining;

    return this.updateItem(lootBoxId, itemId, {
      maxWins: newMaxWins,
    });
  }

  async updateTiming(
    lootBoxId: string,
    updates: { lengthSeconds?: number; revealDelayMs?: number; revealHoldMs?: number }
  ): Promise<LootBoxRecord | undefined> {
    const record = await this.getLootBox(lootBoxId);
    if (!record) {
      return undefined;
    }

    const now = nowIso();
    let changed = false;

    if (updates.lengthSeconds !== undefined) {
      const overlay = {
        ...DEFAULT_OVERLAY_SETTINGS,
        ...(record.overlaySettings || {}),
      };
      overlay.lengthSeconds = updates.lengthSeconds;
      record.overlaySettings = overlay;
      changed = true;
    }

    if (updates.revealDelayMs !== undefined || updates.revealHoldMs !== undefined) {
      const props = {
        ...DEFAULT_LOOTBOX_PROPS,
        ...(record.props || {}),
      };
      props.items = [];

      if (updates.revealDelayMs !== undefined) {
        props.revealDelayMs = updates.revealDelayMs;
        changed = true;
      }
      if (updates.revealHoldMs !== undefined) {
        props.revealHoldMs = updates.revealHoldMs;
        changed = true;
      }

      record.props = props;
    }

    if (!changed) {
      return record;
    }

    record.updatedAt = now;
    await this.writeRecord(record);
    return record;
  }

  async updateLootBoxDetails(
    lootBoxId: string,
    updates: {
      displayName?: string;
      overlaySettings?: Partial<LootBoxOverlaySettings>;
      props?: Partial<LootBoxProps>;
    }
  ): Promise<LootBoxRecord | undefined> {
    const record = await this.getLootBox(lootBoxId);
    if (!record) {
      return undefined;
    }

    const now = nowIso();
    let changed = false;

    if (updates.displayName !== undefined) {
      const nextName = String(updates.displayName ?? "").trim() || record.id;
      if (nextName !== record.displayName) {
        record.displayName = nextName;
        changed = true;
      }
    }

    if (updates.overlaySettings) {
      const overlay = {
        ...DEFAULT_OVERLAY_SETTINGS,
        ...(record.overlaySettings || {}),
      };
      const incoming = updates.overlaySettings;
      const applyOverlayField = <K extends keyof LootBoxOverlaySettings>(key: K) => {
        if (incoming[key] !== undefined) {
          const value = incoming[key];
          if (key === "overlayInstance") {
            const normalized = value ? String(value).trim() : undefined;
            if (overlay.overlayInstance !== normalized) {
              overlay.overlayInstance = normalized;
              changed = true;
            }
          } else if (typeof value === "number" && Number.isFinite(value)) {
            if (overlay[key] !== value) {
              overlay[key] = value as LootBoxOverlaySettings[K];
              changed = true;
            }
          }
        }
      };
      applyOverlayField("lengthSeconds");
      applyOverlayField("durationMs");
      applyOverlayField("overlayInstance");
      record.overlaySettings = overlay;
    }

    if (updates.props) {
      const props = {
        ...DEFAULT_LOOTBOX_PROPS,
        ...(record.props || {}),
      };
      props.items = [];
      const incomingProps = { ...updates.props };
      delete (incomingProps as Partial<LootBoxProps>).items;
      (Object.entries(incomingProps) as Array<[keyof LootBoxProps, LootBoxProps[keyof LootBoxProps]]>).forEach(
        ([key, value]) => {
          if (value === undefined) {
            return;
          }
          if (typeof value === "string") {
            if ((props as any)[key] !== value) {
              (props as any)[key] = value;
              changed = true;
            }
          } else if (typeof value === "boolean") {
            if ((props as any)[key] !== value) {
              (props as any)[key] = value;
              changed = true;
            }
          } else if (typeof value === "number" && Number.isFinite(value)) {
            if ((props as any)[key] !== value) {
              (props as any)[key] = value;
              changed = true;
            }
          }
        }
      );
      record.props = props;
    }

    if (!changed) {
      return record;
    }

    record.updatedAt = now;
    await this.writeRecord(record);
    return record;
  }

  async resetLootBox(lootBoxId: string): Promise<LootBoxRecord | undefined> {
    const record = await this.getLootBox(lootBoxId);
    if (!record) {
      return undefined;
    }

    const now = nowIso();
    for (const item of Object.values(record.items)) {
      item.wins = 0;
      item.updatedAt = now;
      item.lastWonAt = undefined;
    }

    record.lastOpenedAt = undefined;
    record.lastSelectedItemId = undefined;
    record.updatedAt = now;

    await this.writeRecord(record);
    this._pendingSelections.delete(record.id);
    return record;
  }

  async removeLootBox(lootBoxId: string): Promise<boolean> {
    const id = sanitizeLootBoxId(lootBoxId);
    if (!id) {
      return false;
    }

    const existing = await this.getLootBox(id);
    if (!existing) {
      return false;
    }

    try {
      await this.ensureRoot();
      await this._db.delete(`${ROOT_KEY}/${id}`);
    } catch (error) {
      logger.warn(`LootBoxManager: unable to delete loot box "${id}".`, error);
      return false;
    }

    this._pendingSelections.delete(id);
    return true;
  }

  async getInventory(lootBoxId: string): Promise<LootBoxInventoryView[] | undefined> {
    const record = await this.getLootBox(lootBoxId);
    if (!record) {
      return undefined;
    }
    return Object.values(record.items).map((item) => toInventoryView(item));
  }

  async openLootBox(lootBoxId: string): Promise<LootBoxSelection | undefined> {
    const record = await this.getLootBox(lootBoxId);
    if (!record) {
      return undefined;
    }

    const availableItems = Object.values(record.items).filter((item) => {
      if (!item) {
        return false;
      }
      if (item.maxWins === null) {
        return (Number(item.weight) || 0) > 0;
      }
      return item.wins < item.maxWins && (Number(item.weight) || 0) > 0;
    });

    if (!availableItems.length) {
      const totalItems = Object.keys(record.items).length;
      const depletedItems = Object.values(record.items).filter(item =>
        item.maxWins !== null && item.wins >= item.maxWins
      ).length;

      if (this._modules.eventManager) {
        try {
          await emitLootBoxEmpty(this._modules.eventManager, {
            lootBoxId: record.id,
            lootBoxName: record.displayName,
            totalItems,
            depletedItems,
            totalOpens: record.totalOpens || 0
          });
        } catch (error) {
          logger.error("Failed to emit loot box empty event:", error);
        }
      }

      return undefined;
    }

    const selected = weightedSelect(availableItems);
    if (!selected) {
      return undefined;
    }

    const now = nowIso();
    const previousWins = selected.wins;
    const isFirstWin = previousWins === 0;

    const updatedItem = {
      ...selected,
      wins: selected.maxWins === null ? selected.wins + 1 : Math.min(selected.wins + 1, selected.maxWins),
      lastWonAt: now,
      updatedAt: now,
    };

    record.items[updatedItem.id] = updatedItem;
    record.lastOpenedAt = now;
    record.lastSelectedItemId = updatedItem.id;
    record.updatedAt = now;
    record.totalOpens = (record.totalOpens ?? 0) + 1;

    await this.writeRecord(record);

    const selection: LootBoxSelection = {
      lootBoxId: record.id,
      item: updatedItem,
      timestamp: now,
    };

    this._pendingSelections.set(record.id, selection);

    const remaining = updatedItem.maxWins === null ? null : Math.max(0, updatedItem.maxWins - updatedItem.wins);

    if (this._modules.eventManager) {
      try {
        await emitLootBoxOpened(this._modules.eventManager, {
          lootBoxId: record.id,
          lootBoxName: record.displayName,
          item: updatedItem,
          totalOpens: record.totalOpens,
          remaining
        });
      } catch (error) {
        logger.error("Failed to emit loot box opened event:", error);
      }
    }

    if (this._modules.eventManager) {
      try {
        await emitLootBoxItemWon(this._modules.eventManager, {
          lootBoxId: record.id,
          lootBoxName: record.displayName,
          item: updatedItem,
          totalOpens: record.totalOpens,
          remaining,
          isFirstWin
        });
      } catch (error) {
        logger.error("Failed to emit loot box item won event:", error);
      }
    }

    if (updatedItem.maxWins !== null && updatedItem.wins >= updatedItem.maxWins && this._modules.eventManager) {
      const remainingItems = Object.values(record.items).filter(item => {
        if (item.maxWins === null) return true;
        return item.wins < item.maxWins;
      }).length;

      try {
        await emitLootBoxItemDepleted(this._modules.eventManager, {
          lootBoxId: record.id,
          lootBoxName: record.displayName,
          item: updatedItem,
          totalOpens: record.totalOpens,
          remainingItems
        });
      } catch (error) {
        logger.error("Failed to emit loot box item depleted event:", error);
      }
    }

    return selection;
  }

  getPendingSelection(lootBoxId: string): LootBoxSelection | undefined {
    this.cleanupPendingSelections();
    return this._pendingSelections.get(sanitizeLootBoxId(lootBoxId));
  }

  consumePendingSelection(lootBoxId: string): LootBoxSelection | undefined {
    this.cleanupPendingSelections();
    const id = sanitizeLootBoxId(lootBoxId);
    const selection = this._pendingSelections.get(id);
    if (selection) {
      this._pendingSelections.delete(id);
    }
    return selection;
  }

  toClientItem(item: LootBoxInventoryItem): LootBoxItem {
    const remaining = this.computeRemaining(item);
    return {
      id: item.id,
      label: item.label,
      value: item.value,
      subtitle: item.subtitle,
      weight: item.weight,
      maxWins: item.maxWins,
      wins: item.wins,
      remaining,
      lastWonAt: item.lastWonAt,
      imageMode: item.imageMode,
      imageUrl: item.imageUrl,
      imageFile: item.imageFile,
      accentColor: item.accentColor,
    };
  }
}

let lootBoxManagerInstance: LootBoxManager | undefined;

export function createLootBoxManager(dbPath: string, modules: ScriptModules): LootBoxManager {
  if (!lootBoxManagerInstance) {
    lootBoxManagerInstance = new LootBoxManager(dbPath, modules);
  }
  return lootBoxManagerInstance;
}

export { lootBoxManagerInstance as lootBoxManager };
