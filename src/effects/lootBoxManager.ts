import { Firebot, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { logger } from "../logger";
import managerTemplate from "../templates/lootBox-manager-template.html";
import {
  lootBoxManager,
  sanitizeLootBoxId,
  DEFAULT_OVERLAY_SETTINGS,
  DEFAULT_LOOTBOX_PROPS,
} from "../utility/lootbox-manager";
import { LootBoxItem, LootBoxProps, LootBoxOverlaySettings, EventData, LootBoxManagerEffectModel, LootBoxManagerAction, LootBoxSummaryItem } from "../types/types";
import { randomUUID } from "crypto";
import { webServer } from "../main";

const DEFAULT_LENGTH_SECONDS = 15;

export function lootBoxManagerEffectType(
  resourceTokenManager: ScriptModules["resourceTokenManager"]
): Firebot.EffectType<LootBoxManagerEffectModel> {
  const effectType: Firebot.EffectType<LootBoxManagerEffectModel> = {
    definition: {
      id: "msgg:loot-box-manager",
      name: "Advanced Loot Box Manager",
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
        editItem: "Edit Item",
        removeItem: "Remove Item",
        removeLootBox: "Remove Loot Box",
        adjustStock: "Adjust Stock",
        editLootBox: "Edit Loot Box",
        reset: "Reset Loot Box",
      };

      const UI_OVERLAY_DEFAULTS = {
        lengthSeconds: 15,
        durationMs: 2200,
        overlayInstance: "",
      };

      const UI_BOX_PROP_DEFAULTS = {
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
      };

      const defaults: LootBoxManagerEffectModel = {
        selectionMode: "list",
        lootBoxId: "",
        lootBoxDisplay: "",
        action: "open",
        itemDisplay: "",
        manualItemId: "",
        weight: 1,
        maxWins: null,
        stockOperation: "add",
        stockAmount: 1,
        imageMode: "url",
        timingField: "lengthSeconds",
        timingValue: "",
        confirmRemove: "",
        boxDisplayName: "",
        boxOverlayInstance: "",
        boxOverlayDurationMs: String(UI_OVERLAY_DEFAULTS.durationMs),
        boxLengthSeconds: String(UI_OVERLAY_DEFAULTS.lengthSeconds),
        boxRevealDelayMs: String(UI_BOX_PROP_DEFAULTS.revealDelayMs),
        boxRevealHoldMs: String(UI_BOX_PROP_DEFAULTS.revealHoldMs),
        boxBackgroundGradientStart: UI_BOX_PROP_DEFAULTS.backgroundGradientStart,
        boxBackgroundGradientEnd: UI_BOX_PROP_DEFAULTS.backgroundGradientEnd,
        boxHideBackground: UI_BOX_PROP_DEFAULTS.hideBackground,
        boxGlowColor: UI_BOX_PROP_DEFAULTS.glowColor,
        boxAccentColor: UI_BOX_PROP_DEFAULTS.accentColor,
        boxTextColor: UI_BOX_PROP_DEFAULTS.textColor,
        boxSubtitleColor: UI_BOX_PROP_DEFAULTS.subtitleColor,
        boxValueColor: UI_BOX_PROP_DEFAULTS.valueColor,
        boxFontFamily: UI_BOX_PROP_DEFAULTS.fontFamily,
      };

      $scope.effect = {
        ...defaults,
        ...($scope.effect || {}),
      };

      if (!$scope.effect.setting) {
        $scope.effect.setting = {
          type: 'accentColor',
          value: '#ff54d7'
        };
      }

      if (!$scope.effect.itemSetting) {
        $scope.effect.itemSetting = {
          type: 'label',
          value: ''
        };
      }

      $scope.actionOptions = Object.entries(actionLabels).map(([value, label]) => ({
        value,
        label
      }));
      $scope.knownLootBoxes = [] as Array<{ id: string; displayName: string }>;
      $scope.lootBoxItemOptions = [] as string[];
      $scope.lootBoxItemDisplayMap = {} as Record<string, string>;
      $scope.inventorySummary = [] as LootBoxSummaryItem[];
      $scope.lootBoxInventoryMap = {} as Record<string, LootBoxSummaryItem>;
      $scope.timingSnapshot = {
        lengthSeconds: undefined as number | undefined,
        revealDelayMs: undefined as number | undefined,
        revealHoldMs: undefined as number | undefined,
      };
      $scope.fontOptions = [
        "'Montserrat', sans-serif",
        "'Orbitron', sans-serif",
        "'Poppins', sans-serif",
        "'Rajdhani', sans-serif",
        "'Russo One', sans-serif",
        "'Work Sans', sans-serif",
      ];

      const defaultBoxProps = () => ({
        backgroundGradientStart: UI_BOX_PROP_DEFAULTS.backgroundGradientStart,
        backgroundGradientEnd: UI_BOX_PROP_DEFAULTS.backgroundGradientEnd,
        hideBackground: UI_BOX_PROP_DEFAULTS.hideBackground,
        glowColor: UI_BOX_PROP_DEFAULTS.glowColor,
        accentColor: UI_BOX_PROP_DEFAULTS.accentColor,
        textColor: UI_BOX_PROP_DEFAULTS.textColor,
        subtitleColor: UI_BOX_PROP_DEFAULTS.subtitleColor,
        valueColor: UI_BOX_PROP_DEFAULTS.valueColor,
        fontFamily: UI_BOX_PROP_DEFAULTS.fontFamily,
        revealDelayMs: UI_BOX_PROP_DEFAULTS.revealDelayMs,
        revealHoldMs: UI_BOX_PROP_DEFAULTS.revealHoldMs,
      });

      const defaultOverlaySnapshot = () => ({
        lengthSeconds: UI_OVERLAY_DEFAULTS.lengthSeconds,
        durationMs: UI_OVERLAY_DEFAULTS.durationMs,
        overlayInstance: UI_OVERLAY_DEFAULTS.overlayInstance,
      });

      const defaultBoxDetails = () => ({
        displayName: "",
        overlaySettings: defaultOverlaySnapshot(),
        props: defaultBoxProps(),
      });

      $scope.lootBoxDetails = defaultBoxDetails();

      const safeApply = (fn: () => void) => {
        if (!$scope.$$phase && !$scope.$root.$$phase) {
          $scope.$apply(fn);
        } else {
          fn();
        }
      };

      const toStringValue = (value: number | null | undefined): string =>
        value === undefined || value === null || Number.isNaN(value) ? "" : String(value);

      let isApplyingBoxDetails = false;

      const resetBoxFieldsToDefaults = () => {
        const props = defaultBoxProps();
        const overlay = defaultOverlaySnapshot();
        isApplyingBoxDetails = true;
        $scope.effect.boxDisplayName = "";
        $scope.effect.boxOverlayInstance = "";
        $scope.effect.boxOverlayDurationMs = toStringValue(overlay.durationMs);
        $scope.effect.boxLengthSeconds = toStringValue(overlay.lengthSeconds);
        $scope.effect.boxRevealDelayMs = toStringValue(props.revealDelayMs);
        $scope.effect.boxRevealHoldMs = toStringValue(props.revealHoldMs);
        $scope.effect.boxBackgroundGradientStart = props.backgroundGradientStart || "";
        $scope.effect.boxBackgroundGradientEnd = props.backgroundGradientEnd || "";
        $scope.effect.boxHideBackground = !!props.hideBackground;
        $scope.effect.boxGlowColor = props.glowColor || "";
        $scope.effect.boxAccentColor = props.accentColor || "";
        $scope.effect.boxTextColor = props.textColor || "";
        $scope.effect.boxSubtitleColor = props.subtitleColor || "";
        $scope.effect.boxValueColor = props.valueColor || "";
        $scope.effect.boxFontFamily = props.fontFamily || "";
        isApplyingBoxDetails = false;
      };

      const applyBoxDetails = () => {
        if ($scope.effect.action !== "editLootBox" || isApplyingBoxDetails) {
          return;
        }

        const details = $scope.lootBoxDetails || defaultBoxDetails();
        const overlay = {
          ...defaultOverlaySnapshot(),
          ...(details.overlaySettings || {}),
        };
        const props = {
          ...defaultBoxProps(),
          ...(details.props || {}),
        };

        isApplyingBoxDetails = true;
        $scope.effect.boxDisplayName = details.displayName || "";
        $scope.effect.boxOverlayInstance = overlay.overlayInstance || "";
        $scope.effect.boxOverlayDurationMs = toStringValue(overlay.durationMs);
        $scope.effect.boxLengthSeconds = toStringValue(overlay.lengthSeconds);
        $scope.effect.boxRevealDelayMs = toStringValue(props.revealDelayMs);
        $scope.effect.boxRevealHoldMs = toStringValue(props.revealHoldMs);
        $scope.effect.boxBackgroundGradientStart = props.backgroundGradientStart || "";
        $scope.effect.boxBackgroundGradientEnd = props.backgroundGradientEnd || "";
        $scope.effect.boxHideBackground = !!props.hideBackground;
        $scope.effect.boxGlowColor = props.glowColor || "";
        $scope.effect.boxAccentColor = props.accentColor || "";
        $scope.effect.boxTextColor = props.textColor || "";
        $scope.effect.boxSubtitleColor = props.subtitleColor || "";
        $scope.effect.boxValueColor = props.valueColor || "";
        $scope.effect.boxFontFamily = props.fontFamily || "";
        isApplyingBoxDetails = false;
      };

      const loadLootBoxDetails = () => {
        const lootBoxId: string = $scope.effect.lootBoxId;
        if (!lootBoxId) {
          safeApply(() => {
            $scope.lootBoxDetails = defaultBoxDetails();
            resetBoxFieldsToDefaults();
          });
          return;
        }

        safeApply(() => {
          $scope.lootBoxDetails = defaultBoxDetails();
          if ($scope.effect.action === "editLootBox") {
            resetBoxFieldsToDefaults();
          }
        });

        backendCommunicator
          .fireEventAsync("msgg-lootbox:getDetails", { lootBoxId })
          .then((details: any) => {
            safeApply(() => {
              const overlay = {
                ...defaultOverlaySnapshot(),
                ...(details?.overlaySettings || {}),
              };
              const props = {
                ...defaultBoxProps(),
                ...(details?.props || {}),
              };
              $scope.lootBoxDetails = {
                displayName: details?.displayName || lootBoxId,
                overlaySettings: overlay,
                props,
              };
              if ($scope.effect.action === "editLootBox") {
                applyBoxDetails();

                if ($scope.effect.selectionMode === "manual") {
                  syncBoxSettingValue();
                }
              }
            });
          })
          .catch(() => {
            safeApply(() => {
              $scope.lootBoxDetails = defaultBoxDetails();
              resetBoxFieldsToDefaults();
            });
          });
      };

      $scope.resetBoxDefaults = () => {
        resetBoxFieldsToDefaults();
      };

      resetBoxFieldsToDefaults();

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
        const inventoryMap: Record<string, LootBoxSummaryItem> = {};

        list.forEach((item) => {
          inventoryMap[item.id] = item;
          const baseLabel = item.label || item.id;
          let display = baseLabel;
          let counter = 2;
          while (displayMap[display] && displayMap[display] !== item.id) {
            display = `${baseLabel} (${counter++})`;
          }
          displayMap[display] = item.id;
          options.push(display);
        });

        $scope.lootBoxInventoryMap = inventoryMap;
        $scope.lootBoxItemDisplayMap = displayMap;
        $scope.lootBoxItemOptions = options;

        if (!options.length) {
          $scope.effect.itemId = "";
          $scope.effect.itemDisplay = "";
          if ($scope.effect.action === "editItem") {
            clearEditFields();
          }
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

        syncEditFields();

        if ($scope.effect.action === "editItem" && $scope.effect.selectionMode === "manual") {
          syncItemSettingValue();
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
      let isApplyingEditDefaults = false;
      let isApplyingTimingDefaults = false;

      const clearEditFields = () => {
        isApplyingEditDefaults = true;
        $scope.effect.label = "";
        $scope.effect.value = "";
        $scope.effect.subtitle = "";
        $scope.effect.weight = defaults.weight;
        $scope.effect.maxWins = null;
        $scope.effect.imageMode = defaults.imageMode;
        $scope.effect.imageUrl = "";
        $scope.effect.imageFile = "";
        $scope.effect.accentColor = "";
        isApplyingEditDefaults = false;
      };

      const clearTimingValue = () => {
        isApplyingTimingDefaults = true;
        $scope.effect.timingValue = "";
        isApplyingTimingDefaults = false;
      };

      function syncEditFields(): void {
        if ($scope.effect.action !== "editItem" || isApplyingEditDefaults) {
          return;
        }

        const itemId = $scope.effect.selectionMode === "manual"
          ? $scope.effect.manualItemId
          : $scope.effect.itemId;

        if (!itemId) {
          clearEditFields();
          return;
        }

        const selected = $scope.lootBoxInventoryMap[itemId];
        if (!selected) {
          clearEditFields();
          return;
        }

        isApplyingEditDefaults = true;
        $scope.effect.label = selected.label || "";
        $scope.effect.value = selected.value || "";
        $scope.effect.subtitle = selected.subtitle || "";
        $scope.effect.weight = selected.weight ?? defaults.weight;
        $scope.effect.maxWins =
          selected.maxWins === null || selected.maxWins === undefined ? null : selected.maxWins;
        $scope.effect.accentColor = selected.accentColor || "";

        const imageMode = selected.imageMode === "local" ? "local" : "url";
        $scope.effect.imageMode = imageMode;

        if (imageMode === "local") {
          $scope.effect.imageFile = selected.imageFile || "";
          $scope.effect.imageUrl = "";
        } else {
          $scope.effect.imageUrl = selected.imageUrl || "";
          $scope.effect.imageFile = "";
        }

        isApplyingEditDefaults = false;
      }

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
            if ($scope.effect.action === "editItem") {
              clearEditFields();
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
          if ($scope.effect.action === "editItem") {
            syncEditFields();
          }
        }
      );

      function syncItemSettingValue(): void {
        if ($scope.effect.action !== "editItem" || $scope.effect.selectionMode !== "manual") {
          return;
        }

        const itemId = $scope.effect.manualItemId;
        const fieldType = $scope.effect.itemSetting?.type;

        if (!itemId || !fieldType) {
          if ($scope.effect.itemSetting) {
            $scope.effect.itemSetting.value = "";
          }
          return;
        }

        const selected = $scope.lootBoxInventoryMap[itemId];
        if (!selected) {
          if ($scope.effect.itemSetting) {
            $scope.effect.itemSetting.value = "";
          }
          return;
        }

        if ($scope.effect.itemSetting) {
          switch (fieldType) {
            case 'label':
              $scope.effect.itemSetting.value = selected.label || "";
              break;
            case 'value':
              $scope.effect.itemSetting.value = selected.value || "";
              break;
            case 'subtitle':
              $scope.effect.itemSetting.value = selected.subtitle || "";
              break;
            case 'weight':
              $scope.effect.itemSetting.value = selected.weight ?? defaults.weight;
              break;
            case 'maxWins':
              $scope.effect.itemSetting.value = selected.maxWins ?? "";
              break;
            case 'accentColor':
              $scope.effect.itemSetting.value = selected.accentColor || "";
              break;
            case 'imageUrl':
              $scope.effect.itemSetting.value = selected.imageUrl || "";
              break;
            case 'imageFile':
              $scope.effect.itemSetting.value = selected.imageFile || "";
              break;
            default:
              $scope.effect.itemSetting.value = "";
          }
        }
      }

      function syncBoxSettingValue(): void {
        if ($scope.effect.action !== "editLootBox" || $scope.effect.selectionMode !== "manual") {
          return;
        }

        const settingType = $scope.effect.setting?.type;

        if (!settingType || !$scope.lootBoxDetails) {
          if ($scope.effect.setting) {
            $scope.effect.setting.value = "";
          }
          return;
        }

        const details = $scope.lootBoxDetails;
        const overlay = details.overlaySettings || {};
        const props = details.props || {};

        if ($scope.effect.setting) {
          switch (settingType) {
            case 'backgroundGradientStart':
              $scope.effect.setting.value = props.backgroundGradientStart || "";
              break;
            case 'backgroundGradientEnd':
              $scope.effect.setting.value = props.backgroundGradientEnd || "";
              break;
            case 'glowColor':
              $scope.effect.setting.value = props.glowColor || "";
              break;
            case 'accentColor':
              $scope.effect.setting.value = props.accentColor || "";
              break;
            case 'textColor':
              $scope.effect.setting.value = props.textColor || "";
              break;
            case 'subtitleColor':
              $scope.effect.setting.value = props.subtitleColor || "";
              break;
            case 'valueColor':
              $scope.effect.setting.value = props.valueColor || "";
              break;
            case 'fontFamily':
              $scope.effect.setting.value = props.fontFamily || "";
              break;
            case 'hideBackground':
              $scope.effect.setting.value = !!props.hideBackground;
              break;
            case 'revealDelayMs':
              $scope.effect.setting.value = props.revealDelayMs ?? 0;
              break;
            case 'revealHoldMs':
              $scope.effect.setting.value = props.revealHoldMs ?? 0;
              break;
            case 'lengthSeconds':
              $scope.effect.setting.value = overlay.lengthSeconds ?? 0;
              break;
            case 'durationMs':
              $scope.effect.setting.value = overlay.durationMs ?? 0;
              break;
            case 'overlayInstance':
              $scope.effect.setting.value = overlay.overlayInstance || "";
              break;
            case 'displayName':
              $scope.effect.setting.value = details.displayName || "";
              break;

            default:
              $scope.effect.setting.value = "";
          }
        }
      }

      $scope.$watch(
        () => $scope.effect.manualItemId,
        (newId: string) => {
          if ($scope.effect.action === "editItem" && $scope.effect.selectionMode === "manual") {
            syncEditFields();
            syncItemSettingValue();
          }
        }
      );

      $scope.$watch(
        () => $scope.effect.itemSetting?.type,
        () => {
          if ($scope.effect.action === "editItem" && $scope.effect.selectionMode === "manual") {
            syncItemSettingValue();
          }
        }
      );

      $scope.$watch(
        () => $scope.effect.lootBoxDisplay,
        (newDisplay: string) => {
          if (isSyncingSelection) {
            return;
          }
          if (newDisplay && newDisplay !== $scope.effect.lootBoxId) {
            isSyncingSelection = true;
            $scope.effect.lootBoxId = newDisplay;
            isSyncingSelection = false;
          }
        }
      );

      $scope.$watch(
        () => $scope.effect.lootBoxId,
        (newValue: string, oldValue: string) => {
          if (isSyncingSelection) {
            return;
          }
          if (newValue !== oldValue) {
            loadInventory();
            loadLootBoxDetails();
            if ($scope.effect.action === "removeLootBox") {
              $scope.effect.confirmRemove = "";
            }
          }

          if (newValue && newValue !== $scope.effect.lootBoxDisplay) {
            isSyncingSelection = true;
            $scope.effect.lootBoxDisplay = newValue;
            isSyncingSelection = false;
          }

          if ($scope.effect.action === "editLootBox" && $scope.effect.selectionMode === "manual") {
            syncBoxSettingValue();
          }
        }
      );

      $scope.$watch(
        () => $scope.effect.setting?.type,
        () => {
          if ($scope.effect.action === "editLootBox" && $scope.effect.selectionMode === "manual") {
            syncBoxSettingValue();
          }
        }
      );

      $scope.$watch(
        () => $scope.effect.action,
        (newAction: LootBoxManagerAction) => {
          if (newAction === "editItem") {
            if ($scope.effect.lootBoxId) {
              loadInventory();
            }
          }
          if (newAction === "editLootBox") {
            if ($scope.effect.lootBoxId) {
              loadLootBoxDetails();
            }
          }
          if ($scope.effect.confirmRemove !== undefined) {
            $scope.effect.confirmRemove = "";
          }
        }
      );

      $scope.refreshLootBoxes();
      loadInventory();
      loadLootBoxDetails();
    },
    optionsValidator: (effect) => {
      const errors: string[] = [];

      const sanitizeLootBoxId = (value: string): string => {
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

      const sanitizeItemId = (value: string): string => {
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

      const lootBoxId = sanitizeLootBoxId(effect.lootBoxId || "");

      if (!lootBoxId) {
        errors.push("Enter a valid loot box ID (letters, numbers, hyphen, underscore).");
      }

      const getEffectiveItemId = (): string => {
        if (effect.selectionMode === "manual") {
          return sanitizeItemId(effect.manualItemId || "");
        }
        return effect.itemId || "";
      };

      switch (effect.action) {
        case "addItem":
          if (!effect.label) {
            errors.push("Provide a label for the new item.");
          }
          break;
        case "editItem": {
          if (!getEffectiveItemId()) {
            errors.push(effect.selectionMode === "manual"
              ? "Enter an item ID to modify."
              : "Select an item to modify.");
          }

          if (effect.selectionMode === "list") {
            if (!effect.label) {
              errors.push("Provide a label for the item.");
            }
          }

          if (effect.selectionMode === "manual") {
            if (!effect.itemSetting || !effect.itemSetting.type) {
              errors.push("Select a field to update.");
            } else {
              const fieldType = effect.itemSetting.type;
              const fieldValue = effect.itemSetting.value;

              switch (fieldType) {
                case 'label':
                case 'value':
                  if (!fieldValue) {
                    errors.push(`Provide a value for ${fieldType}.`);
                  }
                  break;

                case 'weight':
                  const weight = Number(fieldValue);
                  if (!Number.isFinite(weight) || weight <= 0) {
                    errors.push("Weight must be a positive number.");
                  }
                  break;

                case 'maxWins':
                  if (fieldValue !== null && fieldValue !== undefined && fieldValue !== "") {
                    const maxWins = Number(fieldValue);
                    if (!Number.isFinite(maxWins) || maxWins < 0) {
                      errors.push("Max wins must be a non-negative number or blank.");
                    }
                  }
                  break;
              }
            }
          }
          break;
        }
        case "editLootBox": {
          if (effect.selectionMode === "list") {
            const duration = Number(effect.boxOverlayDurationMs);
            if (!Number.isFinite(duration) || duration <= 0) {
              errors.push("Enter a positive overlay duration (ms).");
            }

            const lengthSeconds = Number(effect.boxLengthSeconds);
            if (!Number.isFinite(lengthSeconds) || lengthSeconds <= 0) {
              errors.push("Enter a positive overlay length (seconds).");
            }

            const revealDelay = Number(effect.boxRevealDelayMs);
            if (!Number.isFinite(revealDelay) || revealDelay < 0) {
              errors.push("Reveal delay must be zero or greater.");
            }

            const revealHold = Number(effect.boxRevealHoldMs);
            if (!Number.isFinite(revealHold) || revealHold < 0) {
              errors.push("Reveal hold must be zero or greater.");
            }

            if (!effect.boxFontFamily) {
              errors.push("Select a font for the loot box.");
            }

            const colorFields: Array<[string | undefined, string]> = [
              [effect.boxBackgroundGradientStart, "background gradient start color"],
              [effect.boxBackgroundGradientEnd, "background gradient end color"],
              [effect.boxGlowColor, "glow color"],
              [effect.boxAccentColor, "accent color"],
              [effect.boxTextColor, "item text color"],
              [effect.boxValueColor, "subtitle color"],
            ];
            colorFields.forEach(([value, label]) => {
              if (!value) {
                errors.push(`Select a ${label}.`);
              }
            });
          }

          if (effect.selectionMode === "manual") {
            if (!effect.setting || !effect.setting.type) {
              errors.push("Select a setting to update.");
            } else {
              const settingType = effect.setting.type;
              const settingValue = effect.setting.value;

              switch (settingType) {
                case 'backgroundGradientStart':
                case 'backgroundGradientEnd':
                case 'glowColor':
                case 'accentColor':
                case 'textColor':
                case 'valueColor':
                case 'fontFamily':
                case 'displayName':
                case 'overlayInstance':
                  break;

                case 'hideBackground':
                  break;

                case 'revealDelayMs':
                case 'revealHoldMs':
                case 'lengthSeconds':
                case 'durationMs':
                  const numValue = Number(settingValue);
                  if (!Number.isFinite(numValue) || numValue < 0) {
                    errors.push(`${settingType} must be a non-negative number.`);
                  }
                  break;
              }
            }
          }
          break;
        }
        case "removeItem":
        case "adjustStock":
          break;
        default:
          break;
      }

      if (effect.action === "adjustStock") {
        const amount = Number(effect.stockAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
          errors.push("Enter a positive amount to adjust the item stock.");
        }
        if (!effect.stockOperation) {
          errors.push("Select whether to add or remove stock.");
        }
      }

      if (effect.action === "addItem" || effect.action === "editItem") {
        const weight = Number(effect.weight);
        if (!Number.isFinite(weight) || weight <= 0) {
          errors.push("Enter a positive weight for the item.");
        }
      }

      if (effect.action === "removeLootBox") {
        const confirmation = sanitizeLootBoxId(effect.confirmRemove || "");
        if (!confirmation || confirmation !== lootBoxId) {
          errors.push("Type the loot box ID above to confirm removal.");
        }
      }

      return errors;
    },
    onTriggerEvent: async (event) => {
      const manager = lootBoxManager;
      if (!manager) {
        logger.error("Advanced Loot Box Manager effect triggered before manager initialisation.");
        return { success: false };
      }

      const rawId = event.effect.lootBoxId || "";
      const lootBoxId = sanitizeLootBoxId(rawId);

      if (!lootBoxId) {
        logger.error("Advanced Loot Box Manager: invalid loot box ID.");
        return { success: false };
      }

      const action = event.effect.action || "open";
      const baseOutputs = {
        winningItem: "",
        remainingStock: "",
      };

      const sanitizeItemId = (value: string): string => {
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

      const getEffectiveItemId = (): string => {
        if (event.effect.selectionMode === "manual") {
          return sanitizeItemId(event.effect.manualItemId || "");
        }
        return event.effect.itemId || "";
      };

      try {
        switch (action) {
          case "open": {
            const selection = await manager.openLootBox(lootBoxId);
            if (!selection) {
              logger.warn(`Advanced Loot Box Manager: no available items to open for "${lootBoxId}".`);
              return { success: false };
            }

            const record = await manager.getLootBox(lootBoxId);
            if (!record) {
              logger.warn(`Advanced Loot Box Manager: unable to load loot box "${lootBoxId}" after opening.`);
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
                    `Advanced Loot Box Manager: failed to prepare local image for item "${decorated.id}"`,
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
          case "editItem": {
            const itemId = getEffectiveItemId();
            if (!itemId) {
              return { success: false };
            }

            if (event.effect.selectionMode === 'list') {
              const weight = Number(event.effect.weight);
              if (!Number.isFinite(weight) || weight <= 0) {
                logger.warn(`Advanced Loot Box Manager: invalid weight value for "${itemId}".`);
                return { success: false };
              }

              const maxWinsValue = event.effect.maxWins;
              let maxWins: number | null = null;
              if (maxWinsValue !== undefined && maxWinsValue !== null && maxWinsValue !== "") {
                const parsed = Number(maxWinsValue);
                if (!Number.isNaN(parsed) && parsed >= 0) {
                  maxWins = Math.floor(parsed);
                }
              }

              const useLocalImage = event.effect.imageMode === "local" && event.effect.imageFile;

              const updates: Partial<LootBoxItem> = {
                label: event.effect.label || "",
                value: event.effect.value || "",
                subtitle: event.effect.subtitle || "",
                weight,
                maxWins,
                imageMode: useLocalImage ? "local" : "url",
                imageUrl: useLocalImage ? "" : event.effect.imageUrl || "",
                imageFile: useLocalImage ? event.effect.imageFile || "" : "",
                accentColor: event.effect.accentColor || "",
              };

              const updated = await manager.updateItem(lootBoxId, itemId, updates);
              if (!updated) {
                logger.warn(`Advanced Loot Box Manager: unable to update item "${itemId}" in "${lootBoxId}".`);
                return { success: false };
              }

              return { success: true, outputs: baseOutputs };
            }

            if (event.effect.selectionMode === 'manual' && event.effect.itemSetting) {
              const fieldType = event.effect.itemSetting.type;
              const fieldValue = event.effect.itemSetting.value;

              logger.debug(`Updating individual field "${fieldType}" for item "${itemId}" in "${lootBoxId}"`);

              const updates: Partial<LootBoxItem> = {};

              switch (fieldType) {
                case 'label':
                case 'value':
                case 'subtitle':
                case 'accentColor':
                  updates[fieldType] = String(fieldValue || "");
                  break;
                case 'imageUrl':
                  updates.imageUrl = String(fieldValue || "");
                  updates.imageMode = "url";
                  updates.imageFile = "";
                  break;
                case 'imageFile':
                  updates.imageFile = String(fieldValue || "");
                  updates.imageMode = "local";
                  updates.imageUrl = "";
                  break;

                case 'weight':
                  const weightValue = Number(fieldValue);
                  if (!Number.isFinite(weightValue) || weightValue <= 0) {
                    logger.warn(`Invalid weight value: ${fieldValue}`);
                    return { success: false };
                  }
                  updates.weight = weightValue;
                  break;

                case 'maxWins':
                  if (fieldValue === null || fieldValue === undefined || fieldValue === "") {
                    updates.maxWins = null;
                  } else {
                    const maxWinsValue = Number(fieldValue);
                    if (!Number.isFinite(maxWinsValue) || maxWinsValue < 0) {
                      logger.warn(`Invalid maxWins value: ${fieldValue}`);
                      return { success: false };
                    }
                    updates.maxWins = Math.floor(maxWinsValue);
                  }
                  break;

                default:
                  logger.warn(`Unknown item field type: ${fieldType}`);
                  return { success: false };
              }

              const updated = await manager.updateItem(lootBoxId, itemId, updates);
              if (!updated) {
                logger.warn(`Advanced Loot Box Manager: unable to update field "${fieldType}" for item "${itemId}".`);
                return { success: false };
              }

              logger.info(`Successfully updated ${fieldType} for item "${itemId}" in loot box "${lootBoxId}"`);
              return { success: true, outputs: baseOutputs };
            }

            logger.warn(`Advanced Loot Box Manager: invalid editItem configuration.`);
            return { success: false };
          }
          case "editLootBox": {
            if (event.effect.selectionMode === 'list' && event.effect.setting) {
              const displayNameInput = event.effect.boxDisplayName ?? "";
              const overlayInstanceInput = event.effect.boxOverlayInstance ?? "";

              const overlayUpdates: Partial<LootBoxOverlaySettings> = {};
              const durationValue = Number(event.effect.boxOverlayDurationMs);
              if (Number.isFinite(durationValue) && durationValue > 0) {
                overlayUpdates.durationMs = Math.max(0, Math.floor(durationValue));
              }

              const lengthValue = Number(event.effect.boxLengthSeconds);
              if (Number.isFinite(lengthValue) && lengthValue > 0) {
                overlayUpdates.lengthSeconds = lengthValue;
              }

              if (overlayInstanceInput !== undefined) {
                const trimmed = String(overlayInstanceInput || "").trim();
                overlayUpdates.overlayInstance = trimmed ? trimmed : "";
              }

              const revealDelayValue = Number(event.effect.boxRevealDelayMs);
              const revealHoldValue = Number(event.effect.boxRevealHoldMs);

              const propsUpdates: Partial<LootBoxProps> = {
                backgroundGradientStart: event.effect.boxBackgroundGradientStart || "",
                backgroundGradientEnd: event.effect.boxBackgroundGradientEnd || "",
                hideBackground: !!event.effect.boxHideBackground,
                glowColor: event.effect.boxGlowColor || "",
                accentColor: event.effect.boxAccentColor || "",
                textColor: event.effect.boxTextColor || "",
                valueColor: event.effect.boxValueColor || "",
                fontFamily: (event.effect.boxFontFamily || "").trim(),
              };

              if (Number.isFinite(revealDelayValue) && revealDelayValue >= 0) {
                propsUpdates.revealDelayMs = Math.max(0, Math.floor(revealDelayValue));
              }

              if (Number.isFinite(revealHoldValue) && revealHoldValue >= 0) {
                propsUpdates.revealHoldMs = Math.max(0, Math.floor(revealHoldValue));
              }

              const updated = await manager.updateLootBoxDetails(lootBoxId, {
                displayName: displayNameInput,
                overlaySettings: overlayUpdates,
                props: propsUpdates,
              });
              if (!updated) {
                logger.warn(`Advanced Loot Box Manager: unable to update loot box settings for "${lootBoxId}".`);
                return { success: false };
              }
              return { success: true, outputs: baseOutputs };

            } else if (event.effect.selectionMode === 'manual' && event.effect.setting) {
              const settingType = event.effect.setting.type;
              const settingValue = event.effect.setting.value;

              logger.debug(`Updating individual setting "${settingType}" for loot box "${lootBoxId}"`);

              const updates: Partial<{
                displayName: string;
                overlaySettings: Partial<LootBoxOverlaySettings>;
                props: Partial<LootBoxProps>;
              }> = {};

              switch (settingType) {
                case 'backgroundGradientStart':
                case 'backgroundGradientEnd':
                case 'glowColor':
                case 'accentColor':
                case 'textColor':
                case 'valueColor':
                case 'fontFamily':
                  updates.props = { fontFamily: String(settingValue) };
                  break;

                case 'hideBackground':
                  updates.props = { [settingType]: Boolean(settingValue) };
                  break;

                case 'revealDelayMs':
                case 'revealHoldMs':
                  const numValue = Number(settingValue);
                  if (!isNaN(numValue) && numValue >= 0) {
                    updates.props = { [settingType]: Math.floor(numValue) };
                  } else {
                    logger.warn(`Invalid ${settingType} value: ${settingValue}`);
                    return { success: false };
                  }
                  break;

                case 'lengthSeconds':
                case 'durationMs':
                  const overlayNumValue = Number(settingValue);
                  if (!isNaN(overlayNumValue) && overlayNumValue >= 0) {
                    updates.overlaySettings = {
                      [settingType]: settingType === 'lengthSeconds' ? overlayNumValue : Math.floor(overlayNumValue)
                    };
                  } else {
                    logger.warn(`Invalid ${settingType} value: ${settingValue}`);
                    return { success: false };
                  }
                  break;

                case 'overlayInstance':
                  updates.overlaySettings = {
                    overlayInstance: String(settingValue) || undefined
                  };
                  break;

                case 'displayName':
                  updates.displayName = String(settingValue);
                  break;

                default:
                  logger.warn(`Unknown setting type: ${settingType}`);
                  return { success: false };
              }

              const updated = await manager.updateLootBoxDetails(lootBoxId, updates);
              if (!updated) {
                logger.warn(`Advanced Loot Box Manager: unable to update setting "${settingType}" for "${lootBoxId}".`);
                return { success: false };
              }

              logger.info(`Successfully updated ${settingType} for loot box "${lootBoxId}"`);
              return { success: true, outputs: baseOutputs };
            }
          }
          case "removeItem": {
            const itemId = getEffectiveItemId();
            if (!itemId) {
              return { success: false };
            }
            const removed = await manager.removeItem(lootBoxId, itemId);
            if (!removed) {
              logger.warn(`Advanced Loot Box Manager: unable to remove item "${itemId}" from "${lootBoxId}".`);
              return { success: false };
            }
            return { success: true, outputs: baseOutputs };
          }
          case "removeLootBox": {
            const confirmation = sanitizeLootBoxId(event.effect.confirmRemove || "");
            if (!confirmation || confirmation !== lootBoxId) {
              logger.warn(`Advanced Loot Box Manager: removal confirmation did not match loot box "${lootBoxId}".`);
              return { success: false };
            }
            const removed = await manager.removeLootBox(lootBoxId);
            if (!removed) {
              logger.warn(`Advanced Loot Box Manager: unable to delete loot box "${lootBoxId}".`);
              return { success: false };
            }
            return { success: true, outputs: baseOutputs };
          }
          case "adjustStock": {
            const itemId = getEffectiveItemId();
            if (!itemId) {
              return { success: false };
            }

            const amount = Number(event.effect.stockAmount);
            if (!Number.isFinite(amount) || amount <= 0) {
              return { success: false };
            }

            const operation = event.effect.stockOperation || "add";
            const delta = operation === "add" ? amount : -amount;

            const updated = await manager.adjustItemRemaining(lootBoxId, itemId, delta);
            if (!updated) {
              logger.warn(`Advanced Loot Box Manager: unable to adjust stock for "${itemId}" in "${lootBoxId}".`);
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
            logger.warn(`Advanced Loot Box Manager: unknown action "${action}".`);
            return { success: false };
        }
      } catch (error) {
        logger.error("Advanced Loot Box Manager action failed", error);
        return { success: false };
      }
    },
  };

  return effectType;
}