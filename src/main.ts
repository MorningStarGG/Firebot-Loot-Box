import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { overlayLootBoxEffectType } from "./effects/lootBox";
import { lootBoxManagerEffectType } from "./effects/lootBoxManager";
import { initLogger, logger } from "./logger";
import { HttpServerManager } from "@crowbartools/firebot-custom-scripts-types/types/modules/http-server-manager";
import {
  createLootBoxManager,
  lootBoxManager,
  sanitizeLootBoxId,
  DEFAULT_LOOTBOX_PROPS,
  DEFAULT_OVERLAY_SETTINGS,
} from "./utility/lootbox-manager";
import { LootBoxInventoryView } from "./types/types";
import { LootBoxEventSource } from "./events/lootbox-events";
import * as lootboxVariables from "./variables/lootbox-variables";
import { Request, Response } from "express";
import lootBoxSystemHtml from "./overlay/lootbox-system.html";

interface Params {
}

const script: Firebot.CustomScript<Params> = {
  getScriptManifest: () => {
    return {
      name: "Advanced Loot Box",
      description: "Customizable loot box with prizes.",
      author: "MorningStarGG",
      version: "1.0",
      firebotVersion: "5",
    };
  },
  getDefaultParameters: () => {
    return {
    };
  },
  run: (runRequest) => {
    const { effectManager, frontendCommunicator, resourceTokenManager, httpServer, eventManager, replaceVariableManager } = runRequest.modules;
    webServer = httpServer;

    initLogger(runRequest.modules.logger);
    logger.info("Advanced Loot Box Script is loading...");

    webServer.registerCustomRoute(
      "lootbox-system",
      "lootbox-system.html",
      "GET",
      (req: Request, res: Response) => {
        res.setHeader('content-type', 'text/html');
        res.end(lootBoxSystemHtml);
      }
    );

    const managerDbPath = runRequest.modules.path.join(SCRIPTS_DIR, "..", "db", "lootbox.db");
    createLootBoxManager(managerDbPath, runRequest.modules);

    eventManager.registerEventSource(LootBoxEventSource);
    logger.info("Loot Box event source registered");

    Object.values(lootboxVariables).forEach(variable => {
      replaceVariableManager.registerReplaceVariable(variable);
    });
    logger.info("Loot Box custom variables registered");

    const request = (runRequest.modules as any).request;
    effectManager.registerEffect(
      overlayLootBoxEffectType(request, frontendCommunicator, resourceTokenManager, runRequest)
    );
    effectManager.registerEffect(lootBoxManagerEffectType(resourceTokenManager));

    const managerEventHandlers = {
      "msgg-lootbox:getLootBoxes": async () => {
        if (!lootBoxManager) {
          return [];
        }
        const boxes = await lootBoxManager.listLootBoxes();
        return boxes.map((box) => ({
          id: box.id,
          displayName: box.displayName || box.id,
        }));
      },
      "msgg-lootbox:getItems": async ({ lootBoxId }: { lootBoxId: string }) => {
        if (!lootBoxManager) {
          return [];
        }
        const id = sanitizeLootBoxId(lootBoxId || "");
        if (!id) {
          return [];
        }
        const inventory = await lootBoxManager.getInventory(id);
        if (!inventory) {
          return [];
        }
        return inventory.map((item: LootBoxInventoryView) => ({
          id: item.id,
          label: item.label,
          value: item.value,
          subtitle: item.subtitle,
          remaining: item.remaining,
          maxWins: item.maxWins,
          wins: item.wins,
          weight: item.weight,
          imageMode: item.imageMode,
          imageUrl: item.imageUrl,
          imageFile: item.imageFile,
          accentColor: item.accentColor,
        }));
      },
      "msgg-lootbox:getDetails": async ({ lootBoxId }: { lootBoxId: string }) => {
        const defaults = {
          displayName: "",
          overlaySettings: { ...DEFAULT_OVERLAY_SETTINGS },
          props: { ...DEFAULT_LOOTBOX_PROPS, items: [] as any[] },
        };
        if (!lootBoxManager) {
          return defaults;
        }
        const id = sanitizeLootBoxId(lootBoxId || "");
        if (!id) {
          return defaults;
        }
        const record = await lootBoxManager.getLootBox(id);
        if (!record) {
          return {
            displayName: id,
            overlaySettings: { ...DEFAULT_OVERLAY_SETTINGS },
            props: { ...DEFAULT_LOOTBOX_PROPS, items: [] as any[] },
          };
        }
        const overlaySettings = {
          ...DEFAULT_OVERLAY_SETTINGS,
          ...(record.overlaySettings || {}),
        };
        const props = {
          ...DEFAULT_LOOTBOX_PROPS,
          ...(record.props || {}),
        };
        props.items = [];
        return {
          displayName: record.displayName || id,
          overlaySettings,
          props,
        };
      },
      "msgg-lootbox:getTiming": async ({ lootBoxId }: { lootBoxId: string }) => {
        if (!lootBoxManager) {
          return {
            lengthSeconds: DEFAULT_OVERLAY_SETTINGS.lengthSeconds,
            revealDelayMs: DEFAULT_LOOTBOX_PROPS.revealDelayMs,
            revealHoldMs: DEFAULT_LOOTBOX_PROPS.revealHoldMs,
          };
        }
        const id = sanitizeLootBoxId(lootBoxId || "");
        if (!id) {
          return {
            lengthSeconds: DEFAULT_OVERLAY_SETTINGS.lengthSeconds,
            revealDelayMs: DEFAULT_LOOTBOX_PROPS.revealDelayMs,
            revealHoldMs: DEFAULT_LOOTBOX_PROPS.revealHoldMs,
          };
        }
        const record = await lootBoxManager.getLootBox(id);
        if (!record) {
          return {
            lengthSeconds: DEFAULT_OVERLAY_SETTINGS.lengthSeconds,
            revealDelayMs: DEFAULT_LOOTBOX_PROPS.revealDelayMs,
            revealHoldMs: DEFAULT_LOOTBOX_PROPS.revealHoldMs,
          };
        }

        const overlay = {
          ...DEFAULT_OVERLAY_SETTINGS,
          ...(record.overlaySettings || {}),
        };
        const props = {
          ...DEFAULT_LOOTBOX_PROPS,
          ...(record.props || {}),
        };

        return {
          lengthSeconds: overlay.lengthSeconds,
          revealDelayMs: props.revealDelayMs,
          revealHoldMs: props.revealHoldMs,
        };
      },
    } as const;

    Object.entries(managerEventHandlers).forEach(([eventName, handler]) => {
      frontendCommunicator.onAsync(eventName, async (payload: any) => {
        try {
          return await handler(payload || {});
        } catch (error) {
          logger.error(`Loot box manager handler "${eventName}" failed`, error);
          return [];
        }
      });
    });
  },
  stop: () => {}
};

export let webServer: HttpServerManager;

export default script;
