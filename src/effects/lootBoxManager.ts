import { Firebot, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { FrontendCommunicator } from "@crowbartools/firebot-custom-scripts-types/types/modules/frontend-communicator";
import { logger } from "../logger";
import managerTemplate from "../templates/lootBox-manager-template.html";
import {
  lootBoxManager,
  sanitizeLootBoxId,
  DEFAULT_OVERLAY_SETTINGS,
  DEFAULT_LOOTBOX_PROPS,
} from "../utility/lootbox-manager";
import { LootBoxItem, LootBoxProps, EventData } from "../types/types";
import { randomUUID } from "crypto";
import { webServer } from "../main";

type LootBoxManagerAction = "open" | "addItem" | "removeItem" | "adjustStock" | "setMaxWins" | "reset";

interface LootBoxManagerEffectModel {
  lootBoxId: string;
  action: LootBoxManagerAction;
  itemId?: string;
  itemDisplay?: string;
  label?: string;
  value?: string;
  subtitle?: string;
  weight?: number | string;
  maxWins?: number | string | null;
  stockDelta?: number | string;
  imageMode?: "url" | "local";
  imageUrl?: string;
  imageFile?: string;
  accentColor?: string;
}

interface LootBoxSummaryItem {
  id: string;
  label: string;
  remaining: number | null;
  maxWins: number | null;
  wins: number;
  weight: number;
}

const DEFAULT_LENGTH_SECONDS = 15;

export function lootBoxManagerEffectType(
  resourceTokenManager: ScriptModules["resourceTokenManager"],
  frontendCommunicator: FrontendCommunicator
): Firebot.EffectType<LootBoxManagerEffectModel> {
  const effectType: Firebot.EffectType<LootBoxManagerEffectModel> = {
    definition: {
      id: "msgg:loot-box-manager",
      name: "Loot Box Manager",
      description: "Open loot boxes, adjust stock, and manage inventory entries.",
      icon: "fad fa-boxes",
      categories: ["overlay"],
      outputs: [
        {
          label: "Winning Item",
          description: "Label of the item selected when opening a loot box.",
          defaultName: "winningItem",
        },
        {
          label: "Winning Value",
          description: "Value of the item selected when opening a loot box.",
          defaultName: "winningValue",
        },
        {
          label: "Remaining Stock",
          description: "Remaining stock after opening the loot box (blank if unlimited).",
          defaultName: "remainingStock",
        },
      ],
    },
    optionsTemplate: managerTemplate,
    optionsController: ($scope: any, backendCommunicator: any) => {
      const actionLabels: Record<LootBoxManagerAction, string> = {
        open: "Open Loot Box",
        addItem: "Add Item",
        removeItem: "Remove Item",
        adjustStock: "Adjust Stock",
        setMaxWins: "Set Max Wins",
        reset: "Reset Loot Box",
      };

      const defaults: LootBoxManagerEffectModel = {
        lootBoxId: "",
        action: "open",
        itemDisplay: "",
        weight: 1,
        maxWins: null,
        stockDelta: 1,
        imageMode: "url",
      };

      $scope.effect = {
        ...defaults,
        ...($scope.effect || {}),
      };

      $scope.actionOptions = actionLabels;
      $scope.knownLootBoxes = [] as Array<{ id: string; displayName: string }>;
      $scope.lootBoxItemOptions = [] as string[];
      $scope.lootBoxItemDisplayMap = {} as Record<string, string>;
      $scope.inventorySummary = [] as LootBoxSummaryItem[];

      const safeApply = (fn: () => void) => {
        if (!$scope.$$phase && !$scope.$root.$$phase) {
          $scope.$apply(fn);
        } else {
          fn();
        }
      };

      $scope.refreshLootBoxes = () => {
        backendCommunicator
          .fireEventAsync("msgg-lootbox:getLootBoxes")
          .then((boxes: Array<{ id: string; displayName: string }>) => {
            safeApply(() => {
              $scope.knownLootBoxes = Array.isArray(boxes) ? boxes : [];
            });
          })
          .catch(() => {
            safeApply(() => {
              $scope.knownLootBoxes = [];
            });
          });
      };

      const populateInventory = (items: LootBoxSummaryItem[] | undefined) => {
        const list = Array.isArray(items) ? items : [];
        $scope.inventorySummary = list;
        const displayMap: Record<string, string> = {};
        const options: string[] = [];

        list.forEach((item) => {
          const baseLabel = item.label || item.id;
          let display = baseLabel;
          let counter = 2;
          while (displayMap[display] && displayMap[display] !== item.id) {
            display = `${baseLabel} (${counter++})`;
          }
          displayMap[display] = item.id;
          options.push(display);
        });

        $scope.lootBoxItemDisplayMap = displayMap;
        $scope.lootBoxItemOptions = options;

        if (!options.length) {
          $scope.effect.itemId = "";
          $scope.effect.itemDisplay = "";
          return;
        }

        const currentId = $scope.effect.itemId;
        const matchingDisplay = Object.keys(displayMap).find((key) => displayMap[key] === currentId);

        if (matchingDisplay) {
          $scope.effect.itemDisplay = matchingDisplay;
        } else {
          const firstDisplay = options[0];
          $scope.effect.itemDisplay = firstDisplay;
          $scope.effect.itemId = displayMap[firstDisplay];
        }
      };

      const loadInventory = () => {
        const lootBoxId: string = $scope.effect.lootBoxId;
        if (!lootBoxId) {
          safeApply(() => {
            populateInventory([]);
          });
          return;
        }
        backendCommunicator
          .fireEventAsync("msgg-lootbox:getItems", { lootBoxId })
          .then((items: LootBoxSummaryItem[]) => {
            safeApply(() => populateInventory(items));
          })
          .catch(() => {
            safeApply(() => populateInventory([]));
          });
      };

      $scope.selectLootBox = (box: { id: string }) => {
        if (!box) {
          return;
        }
        $scope.effect.lootBoxId = box.id;
      };

      let isSyncingSelection = false;

      $scope.$watch(
        () => $scope.effect.itemDisplay,
        (newDisplay: string) => {
          if (isSyncingSelection) {
            return;
          }
          if (!newDisplay) {
            if (!$scope.lootBoxItemOptions.length) {
              isSyncingSelection = true;
              $scope.effect.itemId = "";
              isSyncingSelection = false;
            }
            return;
          }
          const mappedId = $scope.lootBoxItemDisplayMap[newDisplay];
          if (mappedId && mappedId !== $scope.effect.itemId) {
            isSyncingSelection = true;
            $scope.effect.itemId = mappedId;
            isSyncingSelection = false;
          }
        }
      );

      $scope.$watch(
        () => $scope.effect.itemId,
        (newId: string) => {
          if (isSyncingSelection) {
            return;
          }
          if (!newId) {
            if (!$scope.lootBoxItemOptions.length) {
              isSyncingSelection = true;
              $scope.effect.itemDisplay = "";
              isSyncingSelection = false;
            }
            return;
          }
          const display = Object.keys($scope.lootBoxItemDisplayMap).find(
            (key) => $scope.lootBoxItemDisplayMap[key] === newId
          );
          if (display && display !== $scope.effect.itemDisplay) {
            isSyncingSelection = true;
            $scope.effect.itemDisplay = display;
            isSyncingSelection = false;
          }
        }
      );

      $scope.$watch(
        () => $scope.effect.lootBoxId,
        (newValue: string, oldValue: string) => {
          if (newValue !== oldValue) {
            loadInventory();
          }
        }
      );

      $scope.$watch(
        () => $scope.effect.action,
        (newAction: LootBoxManagerAction) => {
          if (["removeItem", "adjustStock", "setMaxWins"].includes(newAction)) {
            loadInventory();
          }
        }
      );

      $scope.refreshLootBoxes();
      loadInventory();
    },
    optionsValidator: (effect) => {
      const errors: string[] = [];
      const lootBoxId = sanitizeLootBoxId(effect.lootBoxId || "");

      if (!lootBoxId) {
        errors.push("Enter a valid loot box ID (letters, numbers, hyphen, underscore).");
      }

      switch (effect.action) {
        case "addItem":
          if (!effect.label) {
            errors.push("Provide a label for the new item.");
          }
          break;
        case "removeItem":
        case "adjustStock":
        case "setMaxWins":
          if (!effect.itemId) {
            errors.push("Select an item to modify.");
          }
          break;
        default:
          break;
      }

      if (effect.action === "adjustStock") {
        const delta = Number(effect.stockDelta);
        if (!Number.isFinite(delta) || delta === 0) {
          errors.push("Enter a non-zero amount to adjust the item stock.");
        }
      }

      if (effect.action === "addItem") {
        const weight = Number(effect.weight);
        if (!Number.isFinite(weight) || weight <= 0) {
          errors.push("Enter a positive weight for the new item.");
        }
      }

      return errors;
    },
    onTriggerEvent: async (event) => {
      const manager = lootBoxManager;
      if (!manager) {
        logger.error("Loot Box Manager effect triggered before manager initialisation.");
        return { success: false };
      }

      const rawId = event.effect.lootBoxId || "";
      const lootBoxId = sanitizeLootBoxId(rawId);

      if (!lootBoxId) {
        logger.error("Loot Box Manager: invalid loot box ID.");
        return { success: false };
      }

      const action = event.effect.action || "open";
      const baseOutputs = {
        winningItem: "",
        winningValue: "",
        remainingStock: "",
      };

      try {
        switch (action) {
          case "open": {
            const selection = await manager.openLootBox(lootBoxId);
            if (!selection) {
              logger.warn(`Loot Box Manager: no available items to open for "${lootBoxId}".`);
              return { success: false };
            }

            const record = await manager.getLootBox(lootBoxId);
            if (!record) {
              logger.warn(`Loot Box Manager: unable to load loot box "${lootBoxId}" after opening.`);
              return { success: false };
            }

            const overlaySettings = record.overlaySettings || { ...DEFAULT_OVERLAY_SETTINGS };
            const ttlSeconds =
              overlaySettings.lengthSeconds && overlaySettings.lengthSeconds > 0
                ? overlaySettings.lengthSeconds
                : DEFAULT_LENGTH_SECONDS;
            const baseProps: LootBoxProps = {
              ...DEFAULT_LOOTBOX_PROPS,
              ...record.props,
              items: [],
            };

            const inventoryItems = Object.values(record.items).map((item) =>
              manager.toClientItem(item)
            );

            const decorateItem = (source: typeof inventoryItems[number]) => {
              const decorated: LootBoxItem = {
                ...source,
              };
              if (decorated.imageMode === "local" && decorated.imageFile && resourceTokenManager) {
                try {
                  decorated.imageToken = resourceTokenManager.storeResourcePath(
                    decorated.imageFile,
                    ttlSeconds
                  );
                } catch (error) {
                  logger.warn(
                    `Loot Box Manager: failed to prepare local image for item "${decorated.id}"`,
                    error
                  );
                }
              }
              if (!decorated.accentColor) {
                decorated.accentColor = baseProps.accentColor;
              }
              return decorated;
            };

            let selectedItem = decorateItem(manager.toClientItem(selection.item));

            const decoratedItems = inventoryItems.map((item) => {
              const decorated = decorateItem(item);
              if (decorated.id === selectedItem.id) {
                selectedItem = decorated;
              }
              return decorated;
            });

            baseProps.items = decoratedItems;

            const eventData: EventData = {
              enterAnimation: overlaySettings.enterAnimation,
              exitAnimation: overlaySettings.exitAnimation,
              enterDuration: overlaySettings.enterDuration,
              exitDuration: overlaySettings.exitDuration,
              inbetweenAnimation: overlaySettings.inbetweenAnimation,
              inbetweenDelay: overlaySettings.inbetweenDelay,
              inbetweenDuration: overlaySettings.inbetweenDuration,
              inbetweenRepeat: overlaySettings.inbetweenRepeat,
              overlayInstance: overlaySettings.overlayInstance,
              lootBoxId,
              uuid: randomUUID(),
              length: overlaySettings.lengthSeconds || DEFAULT_LENGTH_SECONDS,
              props: baseProps,
              duration: overlaySettings.durationMs || baseProps.revealDelayMs,
              selectedItem,
            };

            // @ts-ignore
            webServer.sendToOverlay("msgg-lootbox", eventData);
            manager.consumePendingSelection(lootBoxId);

            return {
              success: true,
              outputs: {
                winningItem: selectedItem.label || "",
                winningValue: selectedItem.value || "",
                remainingStock: selectedItem.remaining === null ? "" : String(selectedItem.remaining),
              },
            };
          }
          case "addItem": {
            const maxWinsValue = event.effect.maxWins;
            let maxWins: number | null = null;
            if (maxWinsValue !== undefined && maxWinsValue !== null && maxWinsValue !== "") {
              const parsed = Number(maxWinsValue);
              if (!Number.isNaN(parsed) && parsed >= 0) {
                maxWins = Math.floor(parsed);
              }
            }

            const useLocalImage = event.effect.imageMode === "local" && event.effect.imageFile;

            const newItem: LootBoxItem = {
              label: event.effect.label || "",
              value: event.effect.value || "",
              subtitle: event.effect.subtitle || "",
              weight: Number(event.effect.weight) || 1,
              maxWins,
              imageMode: useLocalImage ? "local" : "url",
              imageUrl: event.effect.imageUrl || "",
              imageFile: useLocalImage ? event.effect.imageFile || "" : "",
              accentColor: event.effect.accentColor || "",
            };

            await manager.addItem(lootBoxId, newItem);
            return { success: true, outputs: baseOutputs };
          }
          case "removeItem": {
            const itemId = event.effect.itemId;
            if (!itemId) {
              return { success: false };
            }
            const removed = await manager.removeItem(lootBoxId, itemId);
            if (!removed) {
              logger.warn(`Loot Box Manager: unable to remove item "${itemId}" from "${lootBoxId}".`);
              return { success: false };
            }
            return { success: true, outputs: baseOutputs };
          }
          case "adjustStock": {
            const itemId = event.effect.itemId;
            if (!itemId) {
              return { success: false };
            }
            const delta = Number(event.effect.stockDelta);
            if (!Number.isFinite(delta) || delta === 0) {
              return { success: false };
            }
            const updated = await manager.adjustItemRemaining(lootBoxId, itemId, delta);
            if (!updated) {
              logger.warn(`Loot Box Manager: unable to adjust stock for "${itemId}" in "${lootBoxId}".`);
              return { success: false };
            }
            return { success: true, outputs: baseOutputs };
          }
          case "setMaxWins": {
            const itemId = event.effect.itemId;
            if (!itemId) {
              return { success: false };
            }
            const maxWinsInput = event.effect.maxWins;
            let maxWins: number | null = null;
            if (maxWinsInput !== undefined && maxWinsInput !== null && maxWinsInput !== "") {
              const parsed = Number(maxWinsInput);
              if (!Number.isNaN(parsed) && parsed >= 0) {
                maxWins = Math.floor(parsed);
              }
            }
            const updated = await manager.setItemMaxWins(lootBoxId, itemId, maxWins);
            if (!updated) {
              return { success: false };
            }
            return { success: true, outputs: baseOutputs };
          }
          case "reset": {
            const reset = await manager.resetLootBox(lootBoxId);
            if (!reset) {
              return { success: false };
            }
            return { success: true, outputs: baseOutputs };
          }
          default:
            logger.warn(`Loot Box Manager: unknown action "${action}".`);
            return { success: false };
        }
      } catch (error) {
        logger.error("Loot Box Manager action failed", error);
        return { success: false };
      }
    },
  };

  return effectType;
}
