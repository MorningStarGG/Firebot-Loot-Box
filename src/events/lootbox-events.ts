import { EventSource } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-manager";
import { logger } from "../logger";
import { LootBoxInventoryItem } from "../types/types";

export const LOOTBOX_SOURCE_ID = "msgg:lootbox-system";
export const LOOTBOX_OPENED_EVENT = "lootBoxOpened";
export const LOOTBOX_ITEM_WON_EVENT = "lootBoxItemWon";
export const LOOTBOX_EMPTY_EVENT = "lootBoxEmpty";
export const LOOTBOX_ITEM_DEPLETED_EVENT = "lootBoxItemDepleted";

export const LootBoxEventSource: EventSource = {
    id: LOOTBOX_SOURCE_ID,
    name: "Advanced Loot Box System",
    events: [
        {
            id: LOOTBOX_OPENED_EVENT,
            name: "Loot Box Opened",
            description: "Triggered when a loot box is opened and an item is selected",
            cached: false,
            manualMetadata: {
                lootBoxId: "example_lootbox",
                lootBoxName: "Treasure Chest",
                itemId: "mythic-blade",
                itemLabel: "Mythic Blade",
                itemValue: "!give mythic_blade",
                itemSubtitle: "Legendary Drop",
                wins: 5,
                remaining: 10,
                maxWins: 15,
                weight: 1,
                totalOpens: 42
            }
        },
        {
            id: LOOTBOX_ITEM_WON_EVENT,
            name: "Loot Box Item Won",
            description: "Triggered when a loot box item is successfully won (after reveal)",
            cached: false,
            manualMetadata: {
                lootBoxId: "example_lootbox",
                lootBoxName: "Treasure Chest",
                itemId: "mythic-blade",
                itemLabel: "Mythic Blade",
                itemValue: "!give mythic_blade",
                itemSubtitle: "Legendary Drop",
                wins: 5,
                remaining: 10,
                maxWins: 15,
                weight: 1,
                isFirstWin: false,
                totalOpens: 42
            }
        },
        {
            id: LOOTBOX_EMPTY_EVENT,
            name: "Loot Box Empty",
            description: "Triggered when trying to open a loot box with no available items",
            cached: false,
            manualMetadata: {
                lootBoxId: "example_lootbox",
                lootBoxName: "Treasure Chest",
                totalItems: 5,
                depletedItems: 5,
                totalOpens: 42
            }
        },
        {
            id: LOOTBOX_ITEM_DEPLETED_EVENT,
            name: "Loot Box Item Depleted",
            description: "Triggered when an item reaches its maximum wins and becomes unavailable",
            cached: false,
            manualMetadata: {
                lootBoxId: "example_lootbox",
                lootBoxName: "Treasure Chest",
                itemId: "mythic-blade",
                itemLabel: "Mythic Blade",
                itemValue: "!give mythic_blade",
                maxWins: 15,
                totalOpens: 42,
                remainingItems: 4
            }
        }
    ]
};

// Emit loot box opened event
export const emitLootBoxOpened = async (
    eventManager: any,
    data: {
        lootBoxId: string;
        lootBoxName: string;
        item: LootBoxInventoryItem;
        totalOpens: number;
        remaining: number | null;
    }
) => {
    try {
        logger.info(`Emitting loot box opened event for: ${data.lootBoxId}`);
        
        const eventData = {
            lootBoxId: data.lootBoxId,
            lootBoxName: data.lootBoxName,
            itemId: data.item.id,
            itemLabel: data.item.label,
            itemValue: data.item.value,
            itemSubtitle: data.item.subtitle,
            wins: data.item.wins,
            remaining: data.remaining,
            maxWins: data.item.maxWins,
            weight: data.item.weight,
            totalOpens: data.totalOpens,
            timestamp: Date.now()
        };

        await eventManager.triggerEvent(
            LOOTBOX_SOURCE_ID,
            LOOTBOX_OPENED_EVENT,
            eventData
        );

        logger.info('Loot box opened event emitted successfully');
        return true;
    } catch (error) {
        logger.error('Error emitting loot box opened event:', error);
        throw error;
    }
};

// Emit loot box item won event
export const emitLootBoxItemWon = async (
    eventManager: any,
    data: {
        lootBoxId: string;
        lootBoxName: string;
        item: LootBoxInventoryItem;
        totalOpens: number;
        remaining: number | null;
        isFirstWin: boolean;
    }
) => {
    try {
        logger.info(`Emitting loot box item won event for: ${data.item.label}`);
        
        const eventData = {
            lootBoxId: data.lootBoxId,
            lootBoxName: data.lootBoxName,
            itemId: data.item.id,
            itemLabel: data.item.label,
            itemValue: data.item.value,
            itemSubtitle: data.item.subtitle,
            wins: data.item.wins,
            remaining: data.remaining,
            maxWins: data.item.maxWins,
            weight: data.item.weight,
            isFirstWin: data.isFirstWin,
            totalOpens: data.totalOpens,
            timestamp: Date.now()
        };

        await eventManager.triggerEvent(
            LOOTBOX_SOURCE_ID,
            LOOTBOX_ITEM_WON_EVENT,
            eventData
        );

        logger.info('Loot box item won event emitted successfully');
        return true;
    } catch (error) {
        logger.error('Error emitting loot box item won event:', error);
        throw error;
    }
};

// Emit loot box empty event
export const emitLootBoxEmpty = async (
    eventManager: any,
    data: {
        lootBoxId: string;
        lootBoxName: string;
        totalItems: number;
        depletedItems: number;
        totalOpens: number;
    }
) => {
    try {
        logger.info(`Emitting loot box empty event for: ${data.lootBoxId}`);
        
        const eventData = {
            lootBoxId: data.lootBoxId,
            lootBoxName: data.lootBoxName,
            totalItems: data.totalItems,
            depletedItems: data.depletedItems,
            totalOpens: data.totalOpens,
            timestamp: Date.now()
        };

        await eventManager.triggerEvent(
            LOOTBOX_SOURCE_ID,
            LOOTBOX_EMPTY_EVENT,
            eventData
        );

        logger.info('Loot box empty event emitted successfully');
        return true;
    } catch (error) {
        logger.error('Error emitting loot box empty event:', error);
        throw error;
    }
};

// Emit item depleted event
export const emitLootBoxItemDepleted = async (
    eventManager: any,
    data: {
        lootBoxId: string;
        lootBoxName: string;
        item: LootBoxInventoryItem;
        totalOpens: number;
        remainingItems: number;
    }
) => {
    try {
        logger.info(`Emitting loot box item depleted event for: ${data.item.label}`);
        
        const eventData = {
            lootBoxId: data.lootBoxId,
            lootBoxName: data.lootBoxName,
            itemId: data.item.id,
            itemLabel: data.item.label,
            itemValue: data.item.value,
            maxWins: data.item.maxWins,
            totalOpens: data.totalOpens,
            remainingItems: data.remainingItems,
            timestamp: Date.now()
        };

        await eventManager.triggerEvent(
            LOOTBOX_SOURCE_ID,
            LOOTBOX_ITEM_DEPLETED_EVENT,
            eventData
        );

        logger.info('Loot box item depleted event emitted successfully');
        return true;
    } catch (error) {
        logger.error('Error emitting loot box item depleted event:', error);
        throw error;
    }
};