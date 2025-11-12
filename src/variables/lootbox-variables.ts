import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { lootBoxManager, sanitizeLootBoxId } from "../utility/lootbox-manager";
import { logger } from "../logger";
import { LootBoxInventoryItem, LootBoxInventoryView, LootBoxRecord, OptionAliasMap } from "../types/types";

const getLootBoxManager = (): NonNullable<typeof lootBoxManager> => {
    if (!lootBoxManager) {
        throw new Error("Loot box manager is not initialized. Call createLootBoxManager before using loot box variables.");
    }
    return lootBoxManager;
};

const createOptionSet = (params: string[], aliasMap: OptionAliasMap = {}): Set<string> => {
    const result = new Set<string>();
    for (const paramRaw of params) {
        const key = (paramRaw ?? "").toLowerCase().trim();
        if (!key) continue;
        const mapped = aliasMap[key];
        if (!mapped) {
            result.add(key);
        } else if (Array.isArray(mapped)) {
            for (const value of mapped) {
                result.add(value);
            }
        } else {
            result.add(mapped);
        }
    }
    return result;
};

const ensureDefaults = (options: Set<string>, defaults: string[]): void => {
    if (options.size === 0) {
        defaults.forEach((value) => options.add(value));
    }
};

const toBooleanString = (value: boolean): "true" | "false" => (value ? "true" : "false");

const computeAvailableFromRecord = (record?: LootBoxRecord | null): number => {
    if (!record) return 0;
    return Object.values(record.items ?? {}).filter((item) => {
        if (!item) return false;
        if (item.maxWins === null) return true;
        return item.wins < item.maxWins;
    }).length;
};

const computeAvailableFromInventory = (inventory?: LootBoxInventoryView[] | null): number => {
    if (!inventory) return 0;
    return inventory.filter((item) => {
        if (item.remaining === null) return true;
        return item.remaining > 0;
    }).length;
};

const computeRemainingForItem = (item?: LootBoxInventoryItem | null): number | null => {
    if (!item) return null;
    if (item.maxWins === null || item.maxWins === undefined) {
        return null;
    }
    const wins = item.wins ?? 0;
    return Math.max(0, item.maxWins - wins);
};

const formatRemaining = (remaining: number | null): string => (remaining === null ? "unlimited" : String(remaining));

export const lootBoxesVariable: ReplaceVariable = {
    definition: {
        handle: "lootBoxes",
        description: "Returns information about all loot boxes with configurable output.",
        usage: "lootBoxes[fields?]",
        examples: [
            {
                usage: "lootBoxes[]",
                description: "Returns comma-separated list of loot box IDs (default)"
            },
            {
                usage: "lootBoxes[ids]",
                description: "Returns comma-separated list of loot box IDs (explicit)"
            },
            {
                usage: "lootBoxes[names]",
                description: "Returns comma-separated list of display names (e.g., 'Treasure Chest, Mystery Box')"
            },
            {
                usage: "lootBoxes[count]",
                description: "Returns the total number of loot boxes (e.g., 5)"
            },
            {
                usage: "lootBoxes[ids, names]",
                description: "Shows IDs and names (e.g., 'treasure_chest - Treasure Chest, mystery_box - Mystery Box')"
            },
            {
                usage: "lootBoxes[names, opens]",
                description: "Shows names with total opens (e.g., 'Treasure Chest - 42 opens, Mystery Box - 15 opens')"
            },
            {
                usage: "lootBoxes[ids, opens]",
                description: "Shows IDs with total opens (e.g., 'treasure_chest - 42, mystery_box - 15')"
            },
            {
                usage: "lootBoxes[detailed]",
                description: "Shows IDs, names, and opens together (e.g., 'treasure_chest - Treasure Chest - 42 opens')"
            },
            {
                usage: "lootBoxes[raw]",
                description: "Returns raw array of loot box record objects for advanced processing"
            }
        ],
        possibleDataOutput: ["text", "number", "array", "object"]
    },
    evaluator: async (_, ...params: string[]) => {
        const options = createOptionSet(params, {
            id: "ids",
            ids: "ids",
            name: "names",
            names: "names",
            displayname: "names",
            opens: "opens",
            totalopens: "opens",
            total: "count",
            count: "count",
            raw: "raw",
            detailed: ["ids", "names", "opens"]
        });
        ensureDefaults(options, ["ids"]);

        try {
            const boxes = await getLootBoxManager().listLootBoxes();

            if (options.has("raw")) {
                return boxes;
            }

            if (options.has("count") && options.size === 1) {
                return boxes.length;
            }

            if (!boxes.length) {
                return "";
            }

            const showIds = options.has("ids");
            const showNames = options.has("names");
            const showOpens = options.has("opens");

            return boxes
                .map((box) => {
                    const parts: string[] = [];
                    if (showIds) {
                        parts.push(box.id);
                    }
                    if (showNames) {
                        parts.push(box.displayName);
                    }
                    if (showOpens) {
                        const opens = box.totalOpens ?? 0;
                        parts.push(showIds || showNames ? `${opens} opens` : String(opens));
                    }
                    return parts.join(" - ");
                })
                .join(", ");
        } catch (error) {
            logger.error("Error getting loot box collection:", error);
            if (options.has("count") && options.size === 1) {
                return 0;
            }
            if (options.has("raw")) {
                return [];
            }
            return "";
        }
    }
};

export const lootBoxInfoVariable: ReplaceVariable = {
    definition: {
        handle: "lootBoxInfo",
        description: "Returns configurable details for a single loot box.",
        usage: "lootBoxInfo[lootBoxId, fields?]",
        examples: [
            {
                usage: "lootBoxInfo[grand_prize]",
                description: "Shows display name and total opens (default, e.g., 'Grand Prize | 42 opens')"
            },
            {
                usage: "lootBoxInfo[grand_prize, displayName]",
                description: "Returns just the display name (e.g., 'Grand Prize')"
            },
            {
                usage: "lootBoxInfo[grand_prize, id]",
                description: "Returns just the loot box ID (e.g., 'grand_prize')"
            },
            {
                usage: "lootBoxInfo[grand_prize, totalOpens]",
                description: "Returns just the total opens as a number (e.g., 42)"
            },
            {
                usage: "lootBoxInfo[grand_prize, itemCount]",
                description: "Returns total number of items in the loot box (e.g., 10)"
            },
            {
                usage: "lootBoxInfo[grand_prize, availableCount]",
                description: "Returns number of items still available to win (e.g., 7)"
            },
            {
                usage: "lootBoxInfo[grand_prize, lastOpened]",
                description: "Returns ISO timestamp of last open (e.g., '2024-01-15T14:30:00.000Z')"
            },
            {
                usage: "lootBoxInfo[grand_prize, exists]",
                description: "Returns whether the loot box exists (returns 'true' or 'false')"
            },
            {
                usage: "lootBoxInfo[grand_prize, pending]",
                description: "Returns whether there's a pending selection (returns 'true' or 'false')"
            },
            {
                usage: "lootBoxInfo[grand_prize, id, exists]",
                description: "Shows ID and existence (e.g., 'ID: grand_prize | exists')"
            },
            {
                usage: "lootBoxInfo[grand_prize, displayName, totalOpens, itemCount]",
                description: "Shows name, opens, and item count (e.g., 'Grand Prize | 42 opens | 10 items')"
            },
            {
                usage: "lootBoxInfo[grand_prize, itemCount, available]",
                description: "Shows total and available items (e.g., '10 items | 7 available')"
            },
            {
                usage: "lootBoxInfo[grand_prize, raw]",
                description: "Returns the raw loot box record object for advanced processing"
            }
        ],
        possibleDataOutput: ["text", "number", "bool", "object"]
    },
    evaluator: async (_, lootBoxId: string, ...params: string[]) => {
        const options = createOptionSet(params, {
            name: "displayName",
            displayname: "displayName",
            label: "displayName",
            opens: "totalOpens",
            totalopens: "totalOpens",
            total: "totalOpens",
            last: "lastOpened",
            lastopened: "lastOpened",
            exists: "exists",
            available: "availableCount",
            availablecount: "availableCount",
            items: "itemCount",
            itemcount: "itemCount",
            id: "id",
            pending: "pending",
            raw: "raw"
        });
        ensureDefaults(options, ["displayName", "totalOpens"]);

        if (!lootBoxId) {
            if (options.has("totalOpens") && options.size === 1) {
                return 0;
            }
            if (options.has("exists") && options.size === 1) {
                return "false";
            }
            return "";
        }

        try {
            const manager = getLootBoxManager();
            const record = await manager.getLootBox(lootBoxId);
            const exists = !!record;

            if (options.has("raw")) {
                return record ?? null;
            }

            const pendingSelection = manager.getPendingSelection(lootBoxId);
            const pendingExists = !!pendingSelection;

            if (!record) {
                if (options.size === 1) {
                    if (options.has("totalOpens") || options.has("itemCount") || options.has("availableCount")) {
                        return 0;
                    }
                    if (options.has("lastOpened") || options.has("displayName") || options.has("id")) {
                        return "";
                    }
                    if (options.has("exists")) {
                        return "false";
                    }
                    if (options.has("pending")) {
                        return "false";
                    }
                }
                return exists ? "" : (options.has("exists") ? "false" : "");
            }

            const itemCount = Object.keys(record.items ?? {}).length;
            const availableCount = computeAvailableFromRecord(record);

            if (options.size === 1) {
                if (options.has("displayName")) {
                    return record.displayName;
                }
                if (options.has("id")) {
                    return record.id;
                }
                if (options.has("totalOpens")) {
                    return record.totalOpens ?? 0;
                }
                if (options.has("itemCount")) {
                    return itemCount;
                }
                if (options.has("availableCount")) {
                    return availableCount;
                }
                if (options.has("lastOpened")) {
                    return record.lastOpenedAt ?? "";
                }
                if (options.has("exists")) {
                    return toBooleanString(exists);
                }
                if (options.has("pending")) {
                    return toBooleanString(pendingExists);
                }
            }

            const parts: string[] = [];
            if (options.has("displayName")) {
                parts.push(record.displayName);
            }
            if (options.has("id")) {
                parts.push(`ID: ${record.id}`);
            }
            if (options.has("totalOpens")) {
                const opens = record.totalOpens ?? 0;
                parts.push(`${opens} opens`);
            }
            if (options.has("itemCount")) {
                parts.push(`${itemCount} items`);
            }
            if (options.has("availableCount")) {
                parts.push(`${availableCount} available`);
            }
            if (options.has("lastOpened") && record.lastOpenedAt) {
                parts.push(`last opened ${record.lastOpenedAt}`);
            }
            if (options.has("pending")) {
                parts.push(pendingExists ? "pending selection" : "no pending selection");
            }
            if (options.has("exists")) {
                parts.push(exists ? "exists" : "missing");
            }

            return parts.join(" | ");
        } catch (error) {
            logger.error(`Error getting loot box info for ${lootBoxId}:`, error);
            if (options.size === 1) {
                if (options.has("totalOpens") || options.has("itemCount") || options.has("availableCount")) {
                    return 0;
                }
                if (options.has("exists") || options.has("pending")) {
                    return "false";
                }
            }
            return "";
        }
    }
};

export const lootBoxInventoryVariable: ReplaceVariable = {
    definition: {
        handle: "lootBoxInventory",
        description: "Returns formatted inventory information for a loot box with flexible filtering.",
        usage: "lootBoxInventory[lootBoxId, fields?]",
        examples: [
            {
                usage: "lootBoxInventory[grand_prize]",
                description: "Returns comma-separated list of item names (default, e.g., 'Mythic Blade, Phoenix Wings, Credits')"
            },
            {
                usage: "lootBoxInventory[grand_prize, names]",
                description: "Returns comma-separated list of item names (explicit)"
            },
            {
                usage: "lootBoxInventory[grand_prize, ids]",
                description: "Returns comma-separated list of item IDs (e.g., 'mythic-blade, phoenix-wings, credits')"
            },
            {
                usage: "lootBoxInventory[grand_prize, values]",
                description: "Returns comma-separated list of item values (e.g., '!give mythic_blade, !unlock phoenix_wings, 500 credits')"
            },
            {
                usage: "lootBoxInventory[grand_prize, count]",
                description: "Returns total number of items (e.g., 10)"
            },
            {
                usage: "lootBoxInventory[grand_prize, available]",
                description: "Returns number of available items (e.g., 7)"
            },
            {
                usage: "lootBoxInventory[grand_prize, ids, names]",
                description: "Shows IDs and names (e.g., 'mythic-blade - Mythic Blade | phoenix-wings - Phoenix Wings')"
            },
            {
                usage: "lootBoxInventory[grand_prize, names, values]",
                description: "Shows names and values (e.g., 'Mythic Blade - !give mythic_blade | Phoenix Wings - !unlock phoenix_wings')"
            },
            {
                usage: "lootBoxInventory[grand_prize, names, remaining]",
                description: "Shows names with remaining stock (e.g., 'Mythic Blade - remaining: 5 | Phoenix Wings - remaining: unlimited')"
            },
            {
                usage: "lootBoxInventory[grand_prize, names, wins]",
                description: "Shows names with win counts (e.g., 'Mythic Blade - wins: 10 | Phoenix Wings - wins: 3')"
            },
            {
                usage: "lootBoxInventory[grand_prize, names, weights]",
                description: "Shows names with weights (e.g., 'Mythic Blade - weight: 1 | Phoenix Wings - weight: 3')"
            },
            {
                usage: "lootBoxInventory[grand_prize, detailed]",
                description: "Shows IDs, names, values, and remaining (e.g., 'mythic-blade - Mythic Blade - !give mythic_blade - remaining: 5')"
            },
            {
                usage: "lootBoxInventory[grand_prize, onlyAvailable]",
                description: "Returns only items that still have stock available (filters out depleted items)"
            },
            {
                usage: "lootBoxInventory[grand_prize, names, onlyAvailable]",
                description: "Returns names of only available items (e.g., 'Mythic Blade, Phoenix Wings')"
            },
            {
                usage: "lootBoxInventory[grand_prize, names, values, remaining, onlyAvailable]",
                description: "Shows detailed info for only available items"
            },
            {
                usage: "lootBoxInventory[grand_prize, raw]",
                description: "Returns raw array of inventory item objects for advanced processing"
            }
        ],
        possibleDataOutput: ["text", "number", "array", "object"]
    },
    evaluator: async (_, lootBoxId: string, ...params: string[]) => {
        const options = createOptionSet(params, {
            name: "names",
            names: "names",
            label: "names",
            labels: "names",
            id: "ids",
            ids: "ids",
            value: "values",
            values: "values",
            weight: "weights",
            weights: "weights",
            remaining: "remaining",
            stock: "remaining",
            wins: "wins",
            available: "availableCount",
            availablecount: "availableCount",
            count: "count",
            total: "count",
            raw: "raw",
            detailed: ["ids", "names", "values", "remaining"],
            availableonly: "onlyAvailable",
            onlyavailable: "onlyAvailable",
            filteravailable: "onlyAvailable"
        });
        ensureDefaults(options, ["names"]);

        if (!lootBoxId) {
            if (options.has("count") && options.size === 1) {
                return 0;
            }
            if (options.has("availableCount") && options.size === 1) {
                return 0;
            }
            if (options.has("raw")) {
                return [];
            }
            return "";
        }

        const onlyAvailable = options.has("onlyAvailable");
        options.delete("onlyAvailable");

        try {
            const inventory = await getLootBoxManager().getInventory(lootBoxId);

            if (options.has("raw")) {
                return inventory ?? [];
            }

            if (!inventory || inventory.length === 0) {
                if (options.has("count") && options.size === 1) {
                    return 0;
                }
                if (options.has("availableCount") && options.size === 1) {
                    return 0;
                }
                return "";
            }

            const availableCount = computeAvailableFromInventory(inventory);

            if (options.has("availableCount") && options.size === 1) {
                return availableCount;
            }

            if (options.has("count") && options.size === 1) {
                return inventory.length;
            }

            const filtered = onlyAvailable
                ? inventory.filter((item) => item.remaining === null || (item.remaining ?? 0) > 0)
                : inventory;

            if (!filtered.length) {
                return "";
            }

            const showIds = options.has("ids");
            const showNames = options.has("names");
            const showValues = options.has("values");
            const showWeights = options.has("weights");
            const showRemaining = options.has("remaining");
            const showWins = options.has("wins");

            return filtered
                .map((item) => {
                    const parts: string[] = [];
                    if (showIds) {
                        parts.push(item.id);
                    }
                    if (showNames) {
                        parts.push(item.label);
                    }
                    if (showValues) {
                        parts.push(item.value);
                    }
                    if (showWeights) {
                        parts.push(`weight: ${item.weight}`);
                    }
                    if (showWins) {
                        parts.push(`wins: ${item.wins}`);
                    }
                    if (showRemaining) {
                        parts.push(`remaining: ${formatRemaining(item.remaining ?? null)}`);
                    }
                    return parts.join(" - ");
                })
                .join(" | ");
        } catch (error) {
            logger.error(`Error getting loot box inventory for ${lootBoxId}:`, error);
            if (options.has("count") && options.size === 1) {
                return 0;
            }
            if (options.has("availableCount") && options.size === 1) {
                return 0;
            }
            if (options.has("raw")) {
                return [];
            }
            return "";
        }
    }
};

export const lootBoxItemVariable: ReplaceVariable = {
    definition: {
        handle: "lootBoxItem",
        description: "Returns detailed information about a specific loot box item.",
        usage: "lootBoxItem[lootBoxId, itemId, fields?]",
        examples: [
            {
                usage: "lootBoxItem[grand_prize, legend_sword]",
                description: "Returns item label and value (default, e.g., 'Legendary Sword | !give legendary_sword')"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, label]",
                description: "Returns just the item label (e.g., 'Legendary Sword')"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, value]",
                description: "Returns just the item value (e.g., '!give legendary_sword')"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, id]",
                description: "Returns the item ID (e.g., 'legend_sword')"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, wins]",
                description: "Returns number of times won (e.g., 5)"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, remaining]",
                description: "Returns remaining stock (e.g., '10' or 'unlimited')"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, weight]",
                description: "Returns the item's weight (e.g., 1)"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, available]",
                description: "Returns whether item is available (returns 'true' or 'false')"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, lastWon]",
                description: "Returns ISO timestamp of last win (e.g., '2024-01-15T14:30:00.000Z')"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, label, value]",
                description: "Shows label and value (e.g., 'Legendary Sword | !give legendary_sword')"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, label, wins, remaining]",
                description: "Shows label, wins, and remaining (e.g., 'Legendary Sword | wins: 5 | remaining: 10')"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, weight, remaining, available]",
                description: "Shows weight, remaining, and availability (e.g., 'weight: 1 | remaining: 10 | available')"
            },
            {
                usage: "lootBoxItem[grand_prize, legend_sword, raw]",
                description: "Returns the raw item object with all properties for advanced processing"
            }
        ],
        possibleDataOutput: ["text", "number", "bool", "object"]
    },
    evaluator: async (_, lootBoxId: string, itemId: string, ...params: string[]) => {
        const options = createOptionSet(params, {
            name: "label",
            label: "label",
            value: "value",
            values: "value",
            remaining: "remaining",
            stock: "remaining",
            wins: "wins",
            weight: "weight",
            available: "available",
            last: "lastWon",
            lastwon: "lastWon",
            raw: "raw",
            id: "id"
        });
        ensureDefaults(options, ["label", "value"]);

        if (!lootBoxId || !itemId) {
            if (options.has("wins") && options.size === 1) {
                return 0;
            }
            if (options.has("available") && options.size === 1) {
                return "false";
            }
            return "";
        }

        try {
            const manager = getLootBoxManager();
            const record = await manager.getLootBox(lootBoxId);

            if (!record) {
                if (options.has("wins") && options.size === 1) {
                    return 0;
                }
                if (options.has("available") && options.size === 1) {
                    return "false";
                }
                return "";
            }

            const item = record.items[itemId];
            if (!item) {
                if (options.has("wins") && options.size === 1) {
                    return 0;
                }
                if (options.has("available") && options.size === 1) {
                    return "false";
                }
                return "";
            }

            const remainingFromRecord = computeRemainingForItem(item);
            const available = item.maxWins === null || (remainingFromRecord ?? 0) > 0;

            if (options.has("raw")) {
                return {
                    ...item,
                    remaining: remainingFromRecord
                };
            }

            if (options.size === 1) {
                if (options.has("label")) {
                    return item.label ?? "";
                }
                if (options.has("value")) {
                    return item.value ?? "";
                }
                if (options.has("weight")) {
                    return item.weight ?? 0;
                }
                if (options.has("wins")) {
                    return item.wins ?? 0;
                }
                if (options.has("remaining")) {
                    return formatRemaining(remainingFromRecord);
                }
                if (options.has("available")) {
                    return toBooleanString(available);
                }
                if (options.has("lastWon")) {
                    return item.lastWonAt ?? "";
                }
                if (options.has("id")) {
                    return item.id ?? itemId;
                }
            }

            const parts: string[] = [];
            if (options.has("id")) {
                parts.push(item.id ?? itemId);
            }
            if (options.has("label")) {
                parts.push(item.label ?? "");
            }
            if (options.has("value")) {
                parts.push(item.value ?? "");
            }
            if (options.has("weight")) {
                parts.push(`weight: ${item.weight ?? 0}`);
            }
            if (options.has("wins")) {
                parts.push(`wins: ${item.wins ?? 0}`);
            }
            if (options.has("remaining")) {
                parts.push(`remaining: ${formatRemaining(remainingFromRecord)}`);
            }
            if (options.has("available")) {
                parts.push(available ? "available" : "depleted");
            }
            if (options.has("lastWon") && item.lastWonAt) {
                parts.push(`last won ${item.lastWonAt}`);
            }

            return parts.join(" | ");
        } catch (error) {
            logger.error(`Error getting loot box item ${itemId} in ${lootBoxId}:`, error);
            if (options.size === 1) {
                if (options.has("weight") || options.has("wins")) {
                    return 0;
                }
                if (options.has("available")) {
                    return "false";
                }
                if (options.has("remaining") || options.has("label") || options.has("value") || options.has("lastWon") || options.has("id")) {
                    return "";
                }
            }
            return "";
        }
    }
};

export const lootBoxFindVariable: ReplaceVariable = {
    definition: {
        handle: "lootBoxFind",
        description: "Find or search for loot boxes and items with flexible criteria and output formatting.",
        usage: "lootBoxFind[type, query, fields?]",
        examples: [
            {
                usage: "lootBoxFind[boxes, treasure]",
                description: "Find loot boxes with 'treasure' in their ID or name (returns IDs by default)"
            },
            {
                usage: "lootBoxFind[boxes, extra el]",
                description: "Multi-word search: Find boxes matching 'extra' AND 'el' (prioritizes boxes matching both terms in ID+displayName)"
            },
            {
                usage: "lootBoxFind[boxes, treasure, searchId]",
                description: "Find loot boxes with 'treasure' in their ID only (prioritizes exact ID matches)"
            },
            {
                usage: "lootBoxFind[boxes, treasure, searchName]",
                description: "Find loot boxes with 'treasure' in their display name only"
            },
            {
                usage: "lootBoxFind[boxes, treasure, names]",
                description: "Find loot boxes with 'treasure' in their ID or name (returns display names)"
            },
            {
                usage: "lootBoxFind[boxes, treasure, ids, names]",
                description: "Find loot boxes with 'treasure', showing both IDs and names"
            },
            {
                usage: "lootBoxFind[boxes, treasure, detailed]",
                description: "Find loot boxes with 'treasure', showing IDs, names, items, and opens"
            },
            {
                usage: "lootBoxFind[items, sword]",
                description: "Find all items with 'sword' in their label/value/ID (returns names by default)"
            },
            {
                usage: "lootBoxFind[items, sword, names]",
                description: "Find all items with 'sword' (returns item names)"
            },
            {
                usage: "lootBoxFind[items, sword, ids]",
                description: "Find all items with 'sword' (returns item IDs)"
            },
            {
                usage: "lootBoxFind[items, sword, names, lootbox]",
                description: "Find items with 'sword', showing item names and which loot box they're in"
            },
            {
                usage: "lootBoxFind[items, sword, ids, names, lootbox]",
                description: "Find items with 'sword', showing IDs, names, and loot box (e.g., 'mythic-sword - Mythic Sword - in Treasure Chest')"
            },
            {
                usage: "lootBoxFind[itemsIn, grand_prize, sword]",
                description: "Find items with 'sword' ONLY in the grand_prize loot box (returns names)"
            },
            {
                usage: "lootBoxFind[itemsIn, grand_prize, sword, ids]",
                description: "Find items with 'sword' in grand_prize loot box (returns IDs)"
            },
            {
                usage: "lootBoxFind[itemsIn, grand_prize, sword, names, lootbox]",
                description: "Find items with 'sword' in grand_prize, showing names and confirming loot box"
            },
            {
                usage: "lootBoxFind[itemsIn, grand_prize, sword, ids, names]",
                description: "Find items with 'sword' in grand_prize, showing both IDs and names"
            },
            {
                usage: "lootBoxFind[contains, mythic-blade]",
                description: "Find which loot boxes contain the item 'mythic-blade' (returns loot box names)"
            },
            {
                usage: "lootBoxFind[contains, mythic-blade, ids]",
                description: "Find which loot boxes contain 'mythic-blade' (returns loot box IDs)"
            },
            {
                usage: "lootBoxFind[contains, mythic-blade, ids, names]",
                description: "Find which loot boxes contain 'mythic-blade', showing both IDs and names"
            },
            {
                usage: "lootBoxFind[available, true]",
                description: "Find loot boxes with available items (not all depleted) - returns IDs"
            },
            {
                usage: "lootBoxFind[available, true, names]",
                description: "Find loot boxes with available items (returns names)"
            },
            {
                usage: "lootBoxFind[available, true, detailed]",
                description: "Find loot boxes with available items, showing IDs, names, item counts, and opens"
            },
            {
                usage: "lootBoxFind[empty, true]",
                description: "Find loot boxes with no items or all depleted (returns IDs)"
            },
            {
                usage: "lootBoxFind[empty, true, names]",
                description: "Find loot boxes with no items or all depleted (returns names)"
            },
            {
                usage: "lootBoxFind[minItems, 5]",
                description: "Find loot boxes with at least 5 items (returns IDs)"
            },
            {
                usage: "lootBoxFind[minItems, 5, names, items]",
                description: "Find loot boxes with at least 5 items, showing names and item counts"
            },
            {
                usage: "lootBoxFind[minItems, 5, detailed]",
                description: "Find loot boxes with at least 5 items, showing all details"
            },
            {
                usage: "lootBoxFind[opened, true]",
                description: "Find loot boxes that have been opened at least once (returns IDs)"
            },
            {
                usage: "lootBoxFind[opened, true, names, opens]",
                description: "Find opened loot boxes, showing names and open counts"
            },
            {
                usage: "lootBoxFind[minOpens, 10]",
                description: "Find loot boxes with at least 10 opens (returns IDs)"
            },
            {
                usage: "lootBoxFind[minOpens, 10, names, opens]",
                description: "Find loot boxes with at least 10 opens, showing names and open counts"
            },
            {
                usage: "lootBoxFind[pending, true]",
                description: "Find loot boxes with pending selections (returns IDs)"
            },
            {
                usage: "lootBoxFind[pending, true, names]",
                description: "Find loot boxes with pending selections (returns names)"
            },
            {
                usage: "lootBoxFind[hasItems, true]",
                description: "Find loot boxes that have items defined (returns IDs)"
            },
            {
                usage: "lootBoxFind[boxes, treasure, raw]",
                description: "Returns raw array of matching loot box objects"
            },
            {
                usage: "lootBoxFind[items, sword, raw]",
                description: "Returns raw array of matching item objects with loot box info"
            }
        ],
        possibleDataOutput: ["text", "array", "object"]
    },
    evaluator: async (_, typeOrCriteria: string, valueOrQuery: string, ...params: string[]) => {
        const options = createOptionSet(params, {
            id: "ids",
            ids: "ids",
            name: "names",
            names: "names",
            detailed: ["ids", "names", "items", "opens"],
            items: "itemCount",
            itemcount: "itemCount",
            opens: "totalOpens",
            totalopens: "totalOpens",
            available: "availableCount",
            availablecount: "availableCount",
            raw: "raw",
            lootbox: "lootBoxInfo",
            searchid: "searchid",
            "id-only": "searchid",
            idonly: "searchid",
            searchname: "searchname",
            "name-only": "searchname",
            nameonly: "searchname"
        });

        const type = (typeOrCriteria || "").toLowerCase().trim();
        const query = (valueOrQuery || "").toLowerCase().trim();

        try {
            const manager = getLootBoxManager();

            if (type === "boxes" || type === "box" || type === "lootboxes") {
                const boxes = await manager.listLootBoxes();
                
                // Check if user specified search fields (id, name, or both)
                const searchIdOnly = options.has("searchid") || options.has("id-only");
                const searchNameOnly = options.has("searchname") || options.has("name-only");
                const searchBoth = !searchIdOnly && !searchNameOnly;
                
                // Split query into tokens for multi-word search
                const queryTokens = query ? query.split(/\s+/).filter(t => t.length > 0) : [];
                
                let filtered = queryTokens.length > 0
                    ? boxes.filter(box => {
                        const id = box.id.toLowerCase();
                        const name = box.displayName.toLowerCase();
                        
                        // Check if ANY token matches
                        return queryTokens.some(token => {
                            if (searchIdOnly) return id.includes(token);
                            if (searchNameOnly) return name.includes(token);
                            return id.includes(token) || name.includes(token);
                        });
                    })
                    : boxes;
                
                // Prioritize exact matches - if there's an exact match, only return that
                if (queryTokens.length > 0 && filtered.length > 1) {
                    const exactMatch = filtered.find(box => 
                        box.id.toLowerCase() === query ||
                        box.displayName.toLowerCase() === query
                    );
                    if (exactMatch) {
                        filtered = [exactMatch];
                    } else {
                        // Score matches for better relevance when no exact match
                        const scored = filtered.map(box => {
                            const id = box.id.toLowerCase();
                            const name = box.displayName.toLowerCase();
                            let score = 0;
                            
                            // Count how many tokens match in ID vs displayName
                            let idMatches = 0;
                            let nameMatches = 0;
                            let idExactMatches = 0;
                            let nameExactMatches = 0;
                            let idStartsMatches = 0;
                            let nameStartsMatches = 0;
                            
                            for (const token of queryTokens) {
                                // Check ID
                                if (id === token) {
                                    idExactMatches++;
                                    idMatches++;
                                } else if (id.startsWith(token)) {
                                    idStartsMatches++;
                                    idMatches++;
                                } else if (id.includes(token)) {
                                    idMatches++;
                                }
                                
                                // Check displayName (word boundaries for names)
                                const nameWords = name.split(/\s+/);
                                if (name === token) {
                                    nameExactMatches++;
                                    nameMatches++;
                                } else if (nameWords.some(word => word === token)) {
                                    // Exact word match in display name
                                    nameExactMatches++;
                                    nameMatches++;
                                } else if (name.startsWith(token) || nameWords.some(word => word.startsWith(token))) {
                                    nameStartsMatches++;
                                    nameMatches++;
                                } else if (name.includes(token)) {
                                    nameMatches++;
                                }
                            }
                            
                            // Determine if this is a TRUE cross-field match
                            // (different tokens matching different fields, not just substrings in both)
                            const hasTrueCrossFieldMatch = queryTokens.length > 1 && 
                                ((idExactMatches > 0 && nameExactMatches > 0) || 
                                 (idExactMatches > 0 && nameStartsMatches > 0) ||
                                 (idStartsMatches > 0 && nameExactMatches > 0));
                            
                            // Check if it's just substring matches in both fields
                            const hasSubstringInBothFields = idMatches > 0 && nameMatches > 0 && !hasTrueCrossFieldMatch;
                            
                            // Scoring system:
                            // Exact full match (ID or full displayName)
                            if (id === query || name === query) {
                                score += 10000;
                            }
                            // TRUE cross-field matches (exact/starts matches in different fields)
                            else if (hasTrueCrossFieldMatch) {
                                score += 5000; // Very high priority for true cross-field
                                score += idExactMatches * 2000; // Heavily weight exact ID matches
                                score += nameExactMatches * 1500; // Heavily weight exact word matches
                                score += idStartsMatches * 800;
                                score += nameStartsMatches * 600;
                            }
                            // Substring matches in both fields (lower priority)
                            else if (hasSubstringInBothFields) {
                                score += 1000; // Much lower than true cross-field
                                score += idExactMatches * 1000;
                                score += nameExactMatches * 800;
                                score += idStartsMatches * 500;
                                score += nameStartsMatches * 400;
                                score += idMatches * 150;
                                score += nameMatches * 100;
                            }
                            // Single field matches (all tokens in ID or all in displayName)
                            else {
                                score += idExactMatches * 1500;
                                score += nameExactMatches * 1000;
                                score += idStartsMatches * 700;
                                score += nameStartsMatches * 500;
                                score += idMatches * 200;
                                score += nameMatches * 100;
                            }
                            
                            // Bonus for matching more tokens
                            const totalMatches = Math.max(idMatches, nameMatches);
                            score += totalMatches * 50;
                            
                            // Bonus for shorter matches (more specific)
                            const idLengthDiff = Math.abs(id.length - query.length);
                            const nameLengthDiff = Math.abs(name.length - query.length);
                            const minLengthDiff = Math.min(idLengthDiff, nameLengthDiff);
                            score += Math.max(0, 30 - minLengthDiff);
                            
                            return { box, score };
                        });
                        
                        // Sort by score (highest first)
                        scored.sort((a, b) => b.score - a.score);
                        
                        // If there's a clear winner (significantly higher score), return only that
                        const topScore = scored[0].score;
                        const secondScore = scored[1]?.score || 0;
                        
                        // If top score is at least 50% higher than second, it's a clear winner
                        if (topScore > secondScore * 1.5) {
                            filtered = [scored[0].box];
                        } else {
                            // Otherwise return all matches sorted by relevance
                            filtered = scored.map(s => s.box);
                        }
                    }
                }

                if (options.has("raw")) {
                    return filtered;
                }

                if (!filtered.length) {
                    return "";
                }

                ensureDefaults(options, ["ids"]);

                const showIds = options.has("ids");
                const showNames = options.has("names");
                const showItems = options.has("itemCount");
                const showOpens = options.has("totalOpens");

                return filtered
                    .map((box) => {
                        const parts: string[] = [];
                        if (showIds) {
                            parts.push(box.id);
                        }
                        if (showNames) {
                            parts.push(box.displayName);
                        }
                        if (showItems) {
                            const itemCount = Object.keys(box.items ?? {}).length;
                            parts.push(`${itemCount} items`);
                        }
                        if (showOpens) {
                            const opens = box.totalOpens ?? 0;
                            parts.push(`${opens} opens`);
                        }
                        return parts.join(" - ");
                    })
                    .join(" | ");
            }

            if (type === "itemsin" || type === "items-in" || type === "itemin") {
                const boxId = sanitizeLootBoxId(query);
                const searchQuery = (params[0] || "").toLowerCase().trim();
                
                if (!boxId) {
                    return "";
                }

                const box = await manager.getLootBox(boxId);
                if (!box) {
                    return "";
                }

                // Split search query into tokens for multi-word search
                const queryTokens = searchQuery ? searchQuery.split(/\s+/).filter(t => t.length > 0) : [];
                
                let foundItems: Array<{
                    lootBoxId: string;
                    lootBoxName: string;
                    item: LootBoxInventoryItem;
                    score?: number;
                }> = [];

                // Filter items that match any token
                for (const item of Object.values(box.items ?? {})) {
                    if (queryTokens.length === 0) {
                        // No search query - return all items
                        foundItems.push({
                            lootBoxId: box.id,
                            lootBoxName: box.displayName,
                            item
                        });
                        continue;
                    }
                    
                    const id = item.id.toLowerCase();
                    const label = item.label.toLowerCase();
                    const value = item.value.toLowerCase();
                    
                    // Check if ANY token matches
                    const matches = queryTokens.some(token => 
                        id.includes(token) || label.includes(token) || value.includes(token)
                    );
                    
                    if (matches) {
                        foundItems.push({
                            lootBoxId: box.id,
                            lootBoxName: box.displayName,
                            item
                        });
                    }
                }

                // Score items if we have a search query and multiple results
                if (queryTokens.length > 0 && foundItems.length > 1) {
                    foundItems = foundItems.map(entry => {
                        const item = entry.item;
                        const id = item.id.toLowerCase();
                        const label = item.label.toLowerCase();
                        const value = item.value.toLowerCase();
                        let score = 0;
                        
                        // Count matches in each field
                        let idMatches = 0, labelMatches = 0, valueMatches = 0;
                        let idExactMatches = 0, labelExactMatches = 0, valueExactMatches = 0;
                        let idStartsMatches = 0, labelStartsMatches = 0, valueStartsMatches = 0;
                        
                        for (const token of queryTokens) {
                            // ID matching
                            if (id === token) {
                                idExactMatches++;
                                idMatches++;
                            } else if (id.startsWith(token)) {
                                idStartsMatches++;
                                idMatches++;
                            } else if (id.includes(token)) {
                                idMatches++;
                            }
                            
                            // Label matching (word boundaries)
                            const labelWords = label.split(/\s+/);
                            if (label === token) {
                                labelExactMatches++;
                                labelMatches++;
                            } else if (labelWords.some(word => word === token)) {
                                labelExactMatches++;
                                labelMatches++;
                            } else if (label.startsWith(token) || labelWords.some(word => word.startsWith(token))) {
                                labelStartsMatches++;
                                labelMatches++;
                            } else if (label.includes(token)) {
                                labelMatches++;
                            }
                            
                            // Value matching (word boundaries)
                            const valueWords = value.split(/\s+/);
                            if (value === token) {
                                valueExactMatches++;
                                valueMatches++;
                            } else if (valueWords.some(word => word === token)) {
                                valueExactMatches++;
                                valueMatches++;
                            } else if (value.startsWith(token) || valueWords.some(word => word.startsWith(token))) {
                                valueStartsMatches++;
                                valueMatches++;
                            } else if (value.includes(token)) {
                                valueMatches++;
                            }
                        }
                        
                        // Check for exact match to full query
                        if (id === searchQuery || label === searchQuery || value === searchQuery) {
                            score += 10000;
                        } else {
                            // Determine match type
                            const fieldsWithMatches = [idMatches > 0, labelMatches > 0, valueMatches > 0].filter(Boolean).length;
                            const hasExactMatches = idExactMatches > 0 || labelExactMatches > 0 || valueExactMatches > 0;
                            const hasStartsMatches = idStartsMatches > 0 || labelStartsMatches > 0 || valueStartsMatches > 0;
                            
                            // TRUE cross-field match (exact/starts in multiple fields)
                            const hasTrueCrossField = fieldsWithMatches > 1 && (
                                (idExactMatches > 0 || idStartsMatches > 0) && 
                                (labelExactMatches > 0 || labelStartsMatches > 0 || valueExactMatches > 0 || valueStartsMatches > 0)
                            );
                            
                            if (hasTrueCrossField) {
                                score += 5000; // Cross-field bonus
                                score += idExactMatches * 2000;
                                score += labelExactMatches * 1500;
                                score += valueExactMatches * 1200;
                                score += idStartsMatches * 800;
                                score += labelStartsMatches * 600;
                                score += valueStartsMatches * 500;
                            } else if (fieldsWithMatches > 1) {
                                // Substring matches in multiple fields
                                score += 1000;
                                score += idExactMatches * 1000;
                                score += labelExactMatches * 800;
                                score += valueExactMatches * 700;
                                score += idStartsMatches * 500;
                                score += labelStartsMatches * 400;
                                score += valueStartsMatches * 300;
                                score += idMatches * 150;
                                score += labelMatches * 100;
                                score += valueMatches * 80;
                            } else {
                                // Single field matches
                                score += idExactMatches * 1500;
                                score += labelExactMatches * 1000;
                                score += valueExactMatches * 800;
                                score += idStartsMatches * 700;
                                score += labelStartsMatches * 500;
                                score += valueStartsMatches * 400;
                                score += idMatches * 200;
                                score += labelMatches * 120;
                                score += valueMatches * 100;
                            }
                            
                            // Token count bonus
                            const totalMatches = Math.max(idMatches, labelMatches, valueMatches);
                            score += totalMatches * 50;
                        }
                        
                        return { ...entry, score };
                    });
                    
                    // Sort by score
                    foundItems.sort((a, b) => (b.score || 0) - (a.score || 0));
                    
                    // Auto-select if clear winner
                    const topScore = foundItems[0]?.score || 0;
                    const secondScore = foundItems[1]?.score || 0;
                    
                    if (topScore > secondScore * 1.5) {
                        foundItems = [foundItems[0]];
                    }
                }

                if (options.has("raw")) {
                    return foundItems.map(({ item, lootBoxId, lootBoxName }) => ({ item, lootBoxId, lootBoxName }));
                }

                if (!foundItems.length) {
                    return "";
                }

                ensureDefaults(options, ["names"]);

                const showNames = options.has("names");
                const showLootBox = options.has("lootBoxInfo");
                const showIds = options.has("ids");

                return foundItems
                    .map(({ lootBoxId, lootBoxName, item }) => {
                        const parts: string[] = [];
                        if (showIds) {
                            parts.push(item.id);
                        }
                        if (showNames) {
                            parts.push(item.label);
                        }
                        if (showLootBox) {
                            parts.push(`in ${lootBoxName}`);
                        }
                        return parts.join(" - ");
                    })
                    .join(" | ");
            }

            if (type === "items" || type === "item") {
                if (!query) {
                    return "";
                }

                const boxes = await manager.listLootBoxes();
                
                // Split query into tokens for multi-word search
                const queryTokens = query.split(/\s+/).filter(t => t.length > 0);
                
                let foundItems: Array<{
                    lootBoxId: string;
                    lootBoxName: string;
                    item: LootBoxInventoryItem;
                    score?: number;
                }> = [];

                for (const box of boxes) {
                    for (const item of Object.values(box.items ?? {})) {
                        const id = item.id.toLowerCase();
                        const label = item.label.toLowerCase();
                        const value = item.value.toLowerCase();
                        
                        // Check if ANY token matches
                        const matches = queryTokens.some(token =>
                            id.includes(token) || label.includes(token) || value.includes(token)
                        );
                        
                        if (matches) {
                            foundItems.push({
                                lootBoxId: box.id,
                                lootBoxName: box.displayName,
                                item
                            });
                        }
                    }
                }

                // Score items if multiple results
                if (foundItems.length > 1) {
                    foundItems = foundItems.map(entry => {
                        const item = entry.item;
                        const id = item.id.toLowerCase();
                        const label = item.label.toLowerCase();
                        const value = item.value.toLowerCase();
                        let score = 0;
                        
                        // Count matches in each field
                        let idMatches = 0, labelMatches = 0, valueMatches = 0;
                        let idExactMatches = 0, labelExactMatches = 0, valueExactMatches = 0;
                        let idStartsMatches = 0, labelStartsMatches = 0, valueStartsMatches = 0;
                        
                        for (const token of queryTokens) {
                            // ID matching
                            if (id === token) {
                                idExactMatches++;
                                idMatches++;
                            } else if (id.startsWith(token)) {
                                idStartsMatches++;
                                idMatches++;
                            } else if (id.includes(token)) {
                                idMatches++;
                            }
                            
                            // Label matching (word boundaries)
                            const labelWords = label.split(/\s+/);
                            if (label === token) {
                                labelExactMatches++;
                                labelMatches++;
                            } else if (labelWords.some(word => word === token)) {
                                labelExactMatches++;
                                labelMatches++;
                            } else if (label.startsWith(token) || labelWords.some(word => word.startsWith(token))) {
                                labelStartsMatches++;
                                labelMatches++;
                            } else if (label.includes(token)) {
                                labelMatches++;
                            }
                            
                            // Value matching (word boundaries)
                            const valueWords = value.split(/\s+/);
                            if (value === token) {
                                valueExactMatches++;
                                valueMatches++;
                            } else if (valueWords.some(word => word === token)) {
                                valueExactMatches++;
                                valueMatches++;
                            } else if (value.startsWith(token) || valueWords.some(word => word.startsWith(token))) {
                                valueStartsMatches++;
                                valueMatches++;
                            } else if (value.includes(token)) {
                                valueMatches++;
                            }
                        }
                        
                        // Check for exact match to full query
                        if (id === query || label === query || value === query) {
                            score += 10000;
                        } else {
                            // Determine match type
                            const fieldsWithMatches = [idMatches > 0, labelMatches > 0, valueMatches > 0].filter(Boolean).length;
                            
                            // TRUE cross-field match (exact/starts in multiple fields)
                            const hasTrueCrossField = fieldsWithMatches > 1 && (
                                (idExactMatches > 0 || idStartsMatches > 0) && 
                                (labelExactMatches > 0 || labelStartsMatches > 0 || valueExactMatches > 0 || valueStartsMatches > 0)
                            );
                            
                            if (hasTrueCrossField) {
                                score += 5000; // Cross-field bonus
                                score += idExactMatches * 2000;
                                score += labelExactMatches * 1500;
                                score += valueExactMatches * 1200;
                                score += idStartsMatches * 800;
                                score += labelStartsMatches * 600;
                                score += valueStartsMatches * 500;
                            } else if (fieldsWithMatches > 1) {
                                // Substring matches in multiple fields
                                score += 1000;
                                score += idExactMatches * 1000;
                                score += labelExactMatches * 800;
                                score += valueExactMatches * 700;
                                score += idStartsMatches * 500;
                                score += labelStartsMatches * 400;
                                score += valueStartsMatches * 300;
                                score += idMatches * 150;
                                score += labelMatches * 100;
                                score += valueMatches * 80;
                            } else {
                                // Single field matches
                                score += idExactMatches * 1500;
                                score += labelExactMatches * 1000;
                                score += valueExactMatches * 800;
                                score += idStartsMatches * 700;
                                score += labelStartsMatches * 500;
                                score += valueStartsMatches * 400;
                                score += idMatches * 200;
                                score += labelMatches * 120;
                                score += valueMatches * 100;
                            }
                            
                            // Token count bonus
                            const totalMatches = Math.max(idMatches, labelMatches, valueMatches);
                            score += totalMatches * 50;
                        }
                        
                        return { ...entry, score };
                    });

                    foundItems.sort((a, b) => (b.score || 0) - (a.score || 0));
                    
                    const topScore = foundItems[0]?.score || 0;
                    const secondScore = foundItems[1]?.score || 0;
                    
                    if (topScore > secondScore * 1.5) {
                        foundItems = [foundItems[0]];
                    }
                }

                if (options.has("raw")) {
                    return foundItems.map(({ item, lootBoxId, lootBoxName }) => ({ item, lootBoxId, lootBoxName }));
                }

                if (!foundItems.length) {
                    return "";
                }

                ensureDefaults(options, ["names"]);

                const showNames = options.has("names");
                const showLootBox = options.has("lootBoxInfo");
                const showIds = options.has("ids");

                return foundItems
                    .map(({ lootBoxId, lootBoxName, item }) => {
                        const parts: string[] = [];
                        if (showIds) {
                            parts.push(item.id);
                        }
                        if (showNames) {
                            parts.push(item.label);
                        }
                        if (showLootBox) {
                            parts.push(`in ${lootBoxName}`);
                        }
                        return parts.join(" - ");
                    })
                    .join(" | ");
            }

            if (type === "contains" || type === "has" || type === "containing") {
                if (!query) {
                    return "";
                }

                const boxes = await manager.listLootBoxes();
                const containingBoxes = boxes.filter(box => 
                    Object.values(box.items ?? {}).some(item => 
                        item.id.toLowerCase().includes(query) ||
                        item.label.toLowerCase().includes(query)
                    )
                );

                if (options.has("raw")) {
                    return containingBoxes;
                }

                if (!containingBoxes.length) {
                    return "";
                }

                ensureDefaults(options, ["names"]);

                const showIds = options.has("ids");
                const showNames = options.has("names");

                return containingBoxes
                    .map((box) => {
                        const parts: string[] = [];
                        if (showIds) {
                            parts.push(box.id);
                        }
                        if (showNames) {
                            parts.push(box.displayName);
                        }
                        return parts.join(" - ");
                    })
                    .join(" | ");
            }

            const boxes = await manager.listLootBoxes();
            let filtered = boxes;

            switch (type) {
                case "hasitems":
                case "has-items":
                    if (query === "true" || query === "1") {
                        filtered = boxes.filter(box => Object.keys(box.items ?? {}).length > 0);
                    } else {
                        filtered = boxes.filter(box => Object.keys(box.items ?? {}).length === 0);
                    }
                    break;

                case "available":
                    if (query === "true" || query === "1") {
                        filtered = boxes.filter(box => {
                            const available = computeAvailableFromRecord(box);
                            return available > 0;
                        });
                    } else {
                        filtered = boxes.filter(box => {
                            const available = computeAvailableFromRecord(box);
                            return available === 0;
                        });
                    }
                    break;

                case "empty":
                    if (query === "true" || query === "1") {
                        filtered = boxes.filter(box => {
                            const itemCount = Object.keys(box.items ?? {}).length;
                            if (itemCount === 0) return true;
                            const available = computeAvailableFromRecord(box);
                            return available === 0;
                        });
                    } else {
                        filtered = boxes.filter(box => {
                            const itemCount = Object.keys(box.items ?? {}).length;
                            if (itemCount === 0) return false;
                            const available = computeAvailableFromRecord(box);
                            return available > 0;
                        });
                    }
                    break;

                case "minitems":
                case "min-items":
                    const minItems = parseInt(query) || 0;
                    filtered = boxes.filter(box => Object.keys(box.items ?? {}).length >= minItems);
                    break;

                case "minopens":
                case "min-opens":
                    const minOpens = parseInt(query) || 0;
                    filtered = boxes.filter(box => (box.totalOpens ?? 0) >= minOpens);
                    break;

                case "opened":
                    if (query === "true" || query === "1") {
                        filtered = boxes.filter(box => (box.totalOpens ?? 0) > 0);
                    } else {
                        filtered = boxes.filter(box => (box.totalOpens ?? 0) === 0);
                    }
                    break;

                case "pending":
                    if (query === "true" || query === "1") {
                        filtered = boxes.filter(box => !!manager.getPendingSelection(box.id));
                    } else {
                        filtered = boxes.filter(box => !manager.getPendingSelection(box.id));
                    }
                    break;

                default:
                    logger.error(`Invalid type/criteria: ${type}. Use 'boxes', 'items', 'contains', or criteria like 'available', 'empty', etc.`);
                    return "";
            }

            if (options.has("raw")) {
                return filtered;
            }

            if (!filtered.length) {
                return "";
            }

            ensureDefaults(options, ["ids"]);

            const showIds = options.has("ids");
            const showNames = options.has("names");
            const showItems = options.has("itemCount");
            const showOpens = options.has("totalOpens");
            const showAvailable = options.has("availableCount");

            return filtered
                .map((box) => {
                    const parts: string[] = [];
                    if (showIds) {
                        parts.push(box.id);
                    }
                    if (showNames) {
                        parts.push(box.displayName);
                    }
                    if (showItems) {
                        const itemCount = Object.keys(box.items ?? {}).length;
                        parts.push(`${itemCount} items`);
                    }
                    if (showAvailable) {
                        const available = computeAvailableFromRecord(box);
                        parts.push(`${available} available`);
                    }
                    if (showOpens) {
                        const opens = box.totalOpens ?? 0;
                        parts.push(`${opens} opens`);
                    }
                    return parts.join(" - ");
                })
                .join(" | ");

        } catch (error) {
            logger.error(`Error in lootBoxFind:`, error);
            return options.has("raw") ? [] : "";
        }
    }
};

export const lootBoxLastSelectionVariable: ReplaceVariable = {
    definition: {
        handle: "lootBoxLastSelection",
        description: "Returns information about the most recent loot box selection (last item opened).",
        usage: "lootBoxLastSelection[lootBoxId, fields?]",
        examples: [
            {
                usage: "lootBoxLastSelection[grand_prize]",
                description: "Returns the label of the last selected item (default, e.g., 'Mythic Blade')"
            },
            {
                usage: "lootBoxLastSelection[grand_prize, label]",
                description: "Returns just the label of the last selected item (explicit)"
            },
            {
                usage: "lootBoxLastSelection[grand_prize, id]",
                description: "Returns the ID of the last selected item (e.g., 'mythic-blade')"
            },
            {
                usage: "lootBoxLastSelection[grand_prize, value]",
                description: "Returns the value of the last selected item (e.g., '!give mythic_blade')"
            },
            {
                usage: "lootBoxLastSelection[grand_prize, id, label]",
                description: "Shows both ID and label (e.g., 'mythic-blade | Mythic Blade')"
            },
            {
                usage: "lootBoxLastSelection[grand_prize, label, value]",
                description: "Shows label and value (e.g., 'Mythic Blade | !give mythic_blade')"
            },
            {
                usage: "lootBoxLastSelection[grand_prize, id, label, value]",
                description: "Shows all info (e.g., 'mythic-blade | Mythic Blade | !give mythic_blade')"
            },
            {
                usage: "lootBoxLastSelection[grand_prize, raw]",
                description: "Returns raw object with loot box ID, item ID, and full item data"
            }
        ],
        possibleDataOutput: ["text", "object"]
    },
    evaluator: async (_, lootBoxId: string, ...params: string[]) => {
        const options = createOptionSet(params, {
            name: "label",
            label: "label",
            value: "value",
            id: "id",
            raw: "raw"
        });
        ensureDefaults(options, ["label"]);

        if (!lootBoxId) {
            return "";
        }

        try {
            const record = await getLootBoxManager().getLootBox(lootBoxId);
            const lastId = record?.lastSelectedItemId;

            if (!lastId || !record) {
                if (options.size === 1) {
                    return "";
                }
                return "";
            }

            const item = record.items[lastId];

            if (options.has("raw")) {
                return item
                    ? {
                          lootBoxId: record.id,
                          itemId: lastId,
                          item
                      }
                    : null;
            }

            if (options.size === 1) {
                if (options.has("label")) {
                    return item?.label ?? "";
                }
                if (options.has("value")) {
                    return item?.value ?? "";
                }
                if (options.has("id")) {
                    return lastId;
                }
            }

            const parts: string[] = [];
            if (options.has("id")) {
                parts.push(lastId);
            }
            if (options.has("label")) {
                parts.push(item?.label ?? "");
            }
            if (options.has("value")) {
                parts.push(item?.value ?? "");
            }

            return parts.join(" | ");
        } catch (error) {
            logger.error(`Error getting last selection for loot box ${lootBoxId}:`, error);
            return "";
        }
    }
};