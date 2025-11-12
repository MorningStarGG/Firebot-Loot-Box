import { Firebot, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { randomUUID } from "crypto";
import { logger } from "../logger";
import { webServer } from "../main";
import { EventData, EV, LootBoxItem, LootBoxProps, EffectModel } from "../types/types";
import { lootBoxManager, sanitizeLootBoxId } from "../utility/lootbox-manager";
import effectTemplate from "../templates/lootBox-template.html";

const fs = require("fs");

const DEFAULT_LENGTH_SECONDS = 15;

export function overlayLootBoxEffectType(
  request: any,
  frontendCommunicator: ScriptModules["frontendCommunicator"],
  resourceTokenManager: ScriptModules["resourceTokenManager"],
  runRequest: any
) {
  const overlayLootBoxEffectType: Firebot.EffectType<EffectModel> = {
    definition: {
      id: "msgg:loot-box",
      name: "Advanced Loot Box",
      description: "Highly customizable loot box with prizes.",
      icon: "fad fa-box-open",
      categories: ["overlay"],
      dependencies: [],
      triggers: {
        command: true,
        custom_script: true,
        startup_script: true,
        api: true,
        event: true,
        hotkey: true,
        timer: true,
        counter: true,
        preset: true,
        manual: true,
        quick_action: true,
      },
    },
    optionsTemplate: effectTemplate,
    optionsController: ($scope: any, backendCommunicator: any, utilityService: any, $q: any, $rootScope: any) => {
      const DEFAULT_LENGTH_SECONDS_LOCAL = 15;
      $scope.fontOptions = [
        "'Montserrat', sans-serif",
        "'Orbitron', sans-serif",
        "'Poppins', sans-serif",
        "'Rajdhani', sans-serif",
        "'Russo One', sans-serif",
        "'Work Sans', sans-serif",
      ];

      if (!$scope.effect) {
        $scope.effect = {};
      }

      if ($scope.effect.lootBoxId === undefined) {
        $scope.effect.lootBoxId = "";
      }

      if ($scope.effect.lootBoxDisplayName === undefined) {
        $scope.effect.lootBoxDisplayName = "";
      }

      $scope.ensureEventData = () => {
        if (!$scope.effect.EventData) {
          $scope.effect.EventData = { props: {} };
        }
        if (!$scope.effect.EventData.props) {
          $scope.effect.EventData.props = {};
        }
        if (!$scope.effect.EventData.props.items) {
          $scope.effect.EventData.props.items = [];
        }
      };

      $scope.resetDefaults = () => {
        $scope.effect.length = DEFAULT_LENGTH_SECONDS_LOCAL;
        $scope.effect.duration = 2200;
        $scope.effect.fileOrList = "list";
        $scope.ensureEventData();
        $scope.effect.EventData.props = {
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
          items: [
            {
              label: "Mythic Blade",
              subtitle: "Legendary Drop",
              value: "!give mythic_blade",
              weight: 1,
              imageMode: "url",
              imageUrl: "https://placehold.co/256x256/ff4ecd/1f082a?text=Mythic",
              accentColor: "#ff4ecd",
            },
            {
              label: "Phoenix Wings",
              subtitle: "Epic Cosmetic",
              value: "!unlock phoenix_wings",
              weight: 1,
              imageMode: "url",
              imageUrl: "https://placehold.co/256x256/ffa94d/1f082a?text=Phoenix",
              accentColor: "#ffa94d",
            },
            {
              label: "Credits",
              subtitle: "Reward",
              value: "500 credits",
              weight: 1,
              imageMode: "local",
              imageFile: "",
              accentColor: "#ffe8a3",
            },
          ],
        };
      };

      if (!$scope.effect.EventData || !$scope.effect.EventData.props) {
        $scope.resetDefaults();
      } else {
        $scope.ensureEventData();
      }
      $scope.ensureEventData();

      if (!$scope.effect.length) {
        $scope.effect.length = DEFAULT_LENGTH_SECONDS_LOCAL;
      }

      if (!$scope.effect.fileOrList) {
        $scope.effect.fileOrList = "list";
      }

      if ($scope.effect.duration == null) {
        $scope.effect.duration = 2200;
      }

      const props = $scope.effect.EventData.props;

      if (props.backgroundGradientStart == null) {
        $scope.effect.EventData.props.backgroundGradientStart = "#090e36";
      }

      if (props.backgroundGradientEnd == null) {
        $scope.effect.EventData.props.backgroundGradientEnd = "#2a0c41";
      }
      if (props.hideBackground == null) {
        $scope.effect.EventData.props.hideBackground = false;
      }

      if (props.glowColor == null) {
        $scope.effect.EventData.props.glowColor = "#ff9f5a";
      }

      if (props.accentColor == null) {
        $scope.effect.EventData.props.accentColor = "#ff54d7";
      }

      if (props.textColor == null) {
        $scope.effect.EventData.props.textColor = "#ffffff";
      }

      if (props.subtitleColor == null) {
        $scope.effect.EventData.props.subtitleColor = "#ffa94d";
      }

      if (props.valueColor == null) {
        $scope.effect.EventData.props.valueColor = "#ffe8a3";
      }

      if (!props.fontFamily) {
        $scope.effect.EventData.props.fontFamily = "'Montserrat', sans-serif";
      }

      if (props.revealDelayMs == null) {
        $scope.effect.EventData.props.revealDelayMs = 2200;
      }

      if (props.revealHoldMs == null) {
        $scope.effect.EventData.props.revealHoldMs = 5200;
      }

      if (props.showConfetti == null) {
        $scope.effect.EventData.props.showConfetti = true;
      }

      $scope.ensureItemDefaults = (item: LootBoxItem) => {
        if (!item) {
          return;
        }
        if (item.weight == null) {
          item.weight = 1;
        }
        if (!item.imageMode) {
          item.imageMode = "url";
        }
        if (item.maxWins === undefined) {
          item.maxWins = null;
        }
      };

      if (props.items && props.items.length) {
        props.items.forEach($scope.ensureItemDefaults);
      }

      $scope.addLootBoxItem = () => {
        $scope.effect.EventData.props.items.push({
          label: "",
          value: "",
          subtitle: "",
          weight: 1,
          maxWins: null,
          imageMode: "url",
          imageUrl: "",
          accentColor: "",
        });
      };

      $scope.removeLootBoxItemAtIndex = (index: number) => {
        if (index > -1) {
          $scope.effect.EventData.props.items.splice(index, 1);
        }
      };

      $scope.openLink = (url: string) => {
        $rootScope.openLinkExternally(url);
      };

      $scope.resetIfMissing = () => {
        if (!$scope.effect.EventData.props.items) {
          $scope.effect.EventData.props.items = [];
        }
      };
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

      if (effect.length == null || effect.length <= 0) {
        errors.push("Please enter a duration (seconds) for how long the overlay should stay active.");
      }

      if (!effect.lootBoxId || !sanitizeLootBoxId(effect.lootBoxId)) {
        errors.push("Enter a Loot Box ID using letters, numbers, hyphens, or underscores to link with the manager.");
      }

      const props = effect.EventData?.props as LootBoxProps | undefined;

      if (effect.fileOrList === "list" && (!props?.items || props.items.length === 0)) {
        errors.push("Add at least one loot item or switch to file/variable mode.");
      }
      return errors;
    },
    onTriggerEvent: async (event) => {
      const manager = lootBoxManager;
      if (!manager) {
        logger.error("Advanced Loot Box manager is not initialised. Ensure the script run() created it.");
        return { success: false };
      }

      const rawId = event.effect.lootBoxId;
      const lootBoxId = sanitizeLootBoxId(rawId || "");

      if (!lootBoxId) {
        logger.error("Loot Box ID is missing or invalid. Update the effect to provide one.");
        return {
          success: false,
        };
      }

      const sourceMode = event.effect.fileOrList || "list";

      if (sourceMode === "file") {
        const filePath = event.effect.filePath;
        if (!filePath) {
          logger.error("Loot item file path is missing for file mode.");
        } else {
          try {
            const contents = fs.readFileSync(filePath, { encoding: "utf8" });
            event.effect.EventData.props.items = JSON.parse(contents);
          } catch (err) {
            logger.error("Unable to read loot item file", err);
          }
        }
      } else if (sourceMode === "variable") {
        const variablePayload = event.effect.variable;
        if (typeof variablePayload !== "string") {
          logger.error("Loot item variable payload is missing or not a string for variable mode.");
        } else {
          try {
            event.effect.EventData.props.items = JSON.parse(variablePayload);
          } catch (err) {
            logger.error("Unable to parse loot item variable", err);
          }
        }
      }

      const hideBackground = event.effect.EventData.props.hideBackground === true;

      const baseProps: LootBoxProps = {
        backgroundGradientStart: event.effect.EventData.props.backgroundGradientStart,
        backgroundGradientEnd: event.effect.EventData.props.backgroundGradientEnd,
        hideBackground,
        glowColor: event.effect.EventData.props.glowColor,
        accentColor: event.effect.EventData.props.accentColor,
        textColor: event.effect.EventData.props.textColor,
        subtitleColor: event.effect.EventData.props.subtitleColor,
        valueColor: event.effect.EventData.props.valueColor,
        fontFamily: event.effect.EventData.props.fontFamily,
        revealDelayMs: Number(event.effect.EventData.props.revealDelayMs) || 2200,
        revealHoldMs: Number(event.effect.EventData.props.revealHoldMs) || 5200,
        showConfetti: event.effect.EventData.props.showConfetti ?? true,
        items: [],
      };

      const lootItems = (event.effect.EventData.props.items || []) as LootBoxItem[];

      const sanitizedItems: LootBoxItem[] = lootItems
        .filter((item) => item && (item.label || item.value || item.imageUrl || item.imageFile))
        .map((item) => {
          let maxWins: number | null = null;
          const rawMaxWins = (item as unknown as { maxWins?: unknown }).maxWins;
          if (rawMaxWins !== undefined && rawMaxWins !== null && rawMaxWins !== "") {
            const parsed = Number(rawMaxWins);
            if (!Number.isNaN(parsed) && parsed >= 0) {
              maxWins = Math.floor(parsed);
            }
          }

          const sanitized: LootBoxItem = {
            id: item.id,
            label: item.label ?? "",
            value: item.value ?? "",
            subtitle: item.subtitle ?? "",
            weight: Number(item.weight) || 1,
            maxWins,
            imageMode: item.imageMode === "local" ? "local" : "url",
            imageUrl: item.imageUrl ?? "",
            imageFile: item.imageFile ?? "",
            accentColor: item.accentColor ?? "",
          };

          return sanitized;
        });

      try {
        await manager.syncLootBox({
          id: lootBoxId,
          displayName: event.effect.lootBoxDisplayName || rawId || lootBoxId,
          source: sourceMode,
          props: baseProps,
          items: sanitizedItems,
          overlaySettings: {
            lengthSeconds: Number(event.effect.length) || DEFAULT_LENGTH_SECONDS,
            durationMs: Number(event.effect.duration) || baseProps.revealDelayMs,
            overlayInstance: event.effect.overlayInstance,
          },
        });
      } catch (error) {
        logger.error(`Unable to synchronise loot box "${lootBoxId}" with the manager.`, error);
      }

      const selection = manager.consumePendingSelection(lootBoxId);
      if (!selection) {
        logger.warn(
          `Loot Box "${lootBoxId}" does not have a pending selection. Run the Advanced Loot Box Manager effect to open this box before triggering the overlay.`
        );
        return { success: false };
      }

      const selectedItem = manager.toClientItem(selection.item);

      if (selectedItem.imageMode === "local" && selectedItem.imageFile) {
        try {
          selectedItem.imageToken = resourceTokenManager.storeResourcePath(
            selectedItem.imageFile,
            Number(event.effect.length) || DEFAULT_LENGTH_SECONDS
          );
        } catch (err) {
          logger.warn("Unable to prepare local image for loot item", err);
        }
      }

      if (!selectedItem.accentColor) {
        selectedItem.accentColor = baseProps.accentColor;
      }

      try {
        const latestRecord = await manager.getLootBox(lootBoxId);
        if (latestRecord) {
          baseProps.items = Object.values(latestRecord.items).map((item) => manager.toClientItem(item));
        }
      } catch (error) {
        logger.warn(`Unable to load latest loot box state for "${lootBoxId}"`, error);
      }

      if (!baseProps.items.length) {
        baseProps.items = sanitizedItems.length ? sanitizedItems : [selectedItem];
      }

      baseProps.items = baseProps.items.map((item) => {
        if (item.id && selectedItem.id && item.id === selectedItem.id) {
          return selectedItem;
        }
        return item;
      });

      const data: EventData = {
        overlayInstance: event.effect.overlayInstance,
        lootBoxId,
        uuid: randomUUID(),
        length: Number(event.effect.length) || DEFAULT_LENGTH_SECONDS,
        props: baseProps,
        duration: Number(event.effect.duration) || baseProps.revealDelayMs,
        selectedItem,
      };

      const waitPromise = new Promise<LootBoxItem>((resolve) => {
        const listener = (ev: EV<LootBoxItem>) => {
          if (ev.name !== data.uuid) {
            return;
          }
          // @ts-ignore
          webServer.off("overlay-event", listener);
          resolve(ev.data.result);
        };
        // @ts-ignore
        webServer.on("overlay-event", listener);
      });

      // @ts-ignore
      webServer.sendToOverlay("msgg-lootbox", data);

      const winningItem = await waitPromise;

      return {
        success: true
      };
    },
    overlayExtension: {
      dependencies: {
        css: [],
        js: [],
      },
      event: {
        name: "msgg-lootbox",
        onOverlayEvent: (payload: unknown) => {
          const event = payload as EventData;

          fetch(`http://${window.location.hostname}:7472/integrations/lootbox-system/lootbox-system.html`)
            .then(response => response.text())
            .then(html => {

              function appendHtml() {
                const { uuid, props } = event;

                $("#wrapper").append(html.replace("{{MSGG_LOOTBOX_ID}}", uuid));

                const container = document.getElementById(uuid) as HTMLElement | null;

                if (!container) {
                  return;
                }

                container.classList.toggle("msgg-no-background", Boolean(props.hideBackground));

                const mils = event.length ? Number(event.length) * 1000 : DEFAULT_LENGTH_SECONDS * 1000;

                const lootboxEl = container.querySelector(".lootbox") as HTMLElement | null;
                const particlesContainer = container.querySelector(".particles-container") as HTMLElement | null;
                const flashOverlay = container.querySelector(".flash-overlay") as HTMLElement | null;
                const rewardDisplay = container.querySelector(".reward-display") as HTMLElement | null;
                const rewardCard = container.querySelector(".reward-card") as HTMLElement | null;
                const rewardNameEl = container.querySelector(".reward-name") as HTMLElement | null;
                const rewardSubtitleEl = container.querySelector(".reward-subtitle") as HTMLElement | null;
                const rewardValueEl = container.querySelector(".reward-value") as HTMLElement | null;
                const rewardImageWrapper = container.querySelector(".reward-image") as HTMLElement | null;
                const rewardImageEl = rewardImageWrapper?.querySelector("img") as HTMLImageElement | null;
                const rewardImageFallback = rewardImageWrapper?.querySelector(".reward-image-fallback") as HTMLElement | null;
                const rewardGlow = container.querySelector(".reward-glow") as HTMLElement | null;

                if (!lootboxEl || !particlesContainer || !flashOverlay || !rewardDisplay || !rewardCard || !rewardNameEl || !rewardImageWrapper || !rewardImageEl || !rewardImageFallback) {
                  return;
                }

                const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
                const toHex = (value: number) => value.toString(16).padStart(2, "0");
                const parseHex = (color?: string | null) => {
                  if (!color) {
                    return null;
                  }
                  const trimmed = color.trim();
                  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
                  if (!match) {
                    return null;
                  }
                  let hex = match[1];
                  if (hex.length === 3) {
                    hex = hex.split("").map((c) => c + c).join("");
                  }
                  const value = Number.parseInt(hex, 16);
                  if (Number.isNaN(value)) {
                    return null;
                  }
                  return {
                    r: (value >> 16) & 255,
                    g: (value >> 8) & 255,
                    b: value & 255,
                    hex: `#${hex.toLowerCase()}`,
                  };
                };

                const lightenColor = (color: string, amount: number) => {
                  const parsed = parseHex(color);
                  if (!parsed) {
                    return color;
                  }
                  const r = clampChannel(parsed.r + (255 - parsed.r) * amount);
                  const g = clampChannel(parsed.g + (255 - parsed.g) * amount);
                  const b = clampChannel(parsed.b + (255 - parsed.b) * amount);
                  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                };

                const darkenColor = (color: string, amount: number) => {
                  const parsed = parseHex(color);
                  if (!parsed) {
                    return color;
                  }
                  const r = clampChannel(parsed.r * (1 - amount));
                  const g = clampChannel(parsed.g * (1 - amount));
                  const b = clampChannel(parsed.b * (1 - amount));
                  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                };

                const withOpacity = (color: string, alpha: number) => {
                  const parsed = parseHex(color);
                  if (!parsed) {
                    return color;
                  }
                  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
                };

                const baseAccent = props.accentColor || "#fbbf24";
                const baseGlow = props.glowColor || baseAccent;

                const accentLight = lightenColor(baseAccent, 0.35);
                const accentDark = darkenColor(baseAccent, 0.25);
                const glowSoft = lightenColor(baseGlow, 0.4);
                const glowStrong = lightenColor(baseGlow, 0.6);
                const glowAlpha = withOpacity(baseGlow, 0.22);
                const glowStrongAlpha = withOpacity(glowStrong, 0.38);
                const beamStrong = withOpacity(baseGlow, 0.85);
                const beamSoft = withOpacity(glowSoft, 0.55);

                container.style.setProperty("--bg-start", props.backgroundGradientStart || "#090e36");
                container.style.setProperty("--bg-end", props.backgroundGradientEnd || "#2a0c41");
                container.style.setProperty("--font-family", props.fontFamily || "'Montserrat', sans-serif");
                container.style.setProperty("--accent-color", baseAccent);
                container.style.setProperty("--accent-light", accentLight);
                container.style.setProperty("--accent-dark", accentDark);
                container.style.setProperty("--glow-color", baseGlow);
                container.style.setProperty("--glow-soft", glowSoft);
                container.style.setProperty("--glow-strong", glowStrong);
                container.style.setProperty("--glow-alpha", glowAlpha);
                container.style.setProperty("--glow-strong-alpha", glowStrongAlpha);
                container.style.setProperty("--beam-strong", beamStrong);
                container.style.setProperty("--beam-soft", beamSoft);
                container.style.setProperty("--text-color", props.textColor || "#ffffff");
                container.style.setProperty("--subtitle-color", props.subtitleColor || "#ffa94d");
                container.style.setProperty("--value-color", props.valueColor || "#ffe8a3");

                rewardNameEl.textContent = "";
                if (rewardSubtitleEl) {
                  rewardSubtitleEl.textContent = "";
                  rewardSubtitleEl.style.display = "none";
                }
                if (rewardValueEl) {
                  rewardValueEl.textContent = "";
                  rewardValueEl.style.display = "none";
                }
                rewardImageEl.style.display = "none";
                rewardImageFallback.style.display = "flex";
                rewardImageFallback.textContent = "?";

                container.classList.add("msgg-entered");
                container.classList.add("msgg-charge");

                const resolveImageUrl = (item: LootBoxItem): string => {
                  if (item.imageMode === "local" && item.imageToken) {
                    return `http://${window.location.hostname}:7472/resource/${item.imageToken}`;
                  }
                  return item.imageUrl || "";
                };

                const parseDurationToMs = (duration: number | string | undefined, fallback: number) => {
                  if (duration == null) {
                    return fallback;
                  }
                  if (typeof duration === "number") {
                    return duration;
                  }
                  const numeric = Number.parseFloat(duration);
                  if (Number.isNaN(numeric)) {
                    return fallback;
                  }
                  if (duration.includes("ms")) {
                    return numeric;
                  }
                  return numeric * 1000;
                };

                const selectWeightedItem = (items: LootBoxItem[]): LootBoxItem | undefined => {
                  const validItems = (items || []).filter((it) => (Number(it.weight) || 0) > 0);
                  if (!validItems.length) {
                    return undefined;
                  }
                  const totalWeight = validItems.reduce((total, current) => total + (Number(current.weight) || 1), 0);
                  let random = Math.random() * totalWeight;
                  for (const item of validItems) {
                    random -= Number(item.weight) || 1;
                    if (random <= 0) {
                      return item;
                    }
                  }
                  return validItems[validItems.length - 1];
                };

                const ensureConfetti = (callback: () => void) => {
                  if (!props.showConfetti) {
                    return;
                  }
                  if (typeof (window as any).confetti === "function") {
                    callback();
                    return;
                  }
                  const scriptId = "msgg-confetti-lib";
                  const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
                  if (existing) {
                    existing.addEventListener("load", () => callback(), { once: true });
                    return;
                  }
                  const script = document.createElement("script");
                  script.id = scriptId;
                  script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js";
                  script.async = true;
                  script.addEventListener("load", () => callback(), { once: true });
                  document.head.appendChild(script);
                };

                let selectedItem = event.selectedItem as LootBoxItem | undefined;

                if (!selectedItem && props.items && props.items.length) {
                  selectedItem = selectWeightedItem(props.items);
                }

                if (!selectedItem) {
                  console.warn("Advanced Loot Box: no item selected for reveal. Ensure the Advanced Loot Box Manager effect has opened a box and an item is available.");
                  return;
                }

                const rewardAccent = selectedItem.accentColor || baseAccent;
                const rewardAccentLight = lightenColor(rewardAccent, 0.4);
                const rewardAccentAlpha = withOpacity(rewardAccent, 0.35);
                const rewardAccentStrong = withOpacity(rewardAccent, 0.6);

                container.style.setProperty("--reward-accent", rewardAccent);
                container.style.setProperty("--reward-accent-light", rewardAccentLight);
                container.style.setProperty("--reward-accent-alpha", rewardAccentAlpha);
                container.style.setProperty("--reward-accent-strong", rewardAccentStrong);

                rewardNameEl.textContent = selectedItem.label || "Mystery Reward";

                if (rewardSubtitleEl) {
                  if (selectedItem.subtitle) {
                    rewardSubtitleEl.textContent = selectedItem.subtitle;
                    rewardSubtitleEl.style.display = "block";
                  } else {
                    rewardSubtitleEl.textContent = "";
                    rewardSubtitleEl.style.display = "none";
                  }
                }

                if (rewardValueEl) {
                  if (selectedItem.value) {
                    rewardValueEl.textContent = selectedItem.value;
                    rewardValueEl.style.display = "block";
                  } else {
                    rewardValueEl.textContent = "";
                    rewardValueEl.style.display = "none";
                  }
                }

                const resolvedImage = resolveImageUrl(selectedItem);
                if (resolvedImage) {
                  rewardImageEl.src = resolvedImage;
                  rewardImageEl.style.display = "block";
                  rewardImageFallback.style.display = "none";
                } else {
                  rewardImageEl.removeAttribute("src");
                  rewardImageEl.style.display = "none";
                  rewardImageFallback.style.display = "flex";
                  rewardImageFallback.textContent = (selectedItem.label || "?").charAt(0).toUpperCase();
                }

                rewardImageWrapper.style.background = `linear-gradient(145deg, ${rewardAccentLight}, ${rewardAccent})`;
                rewardImageWrapper.style.boxShadow = `0 0 40px ${rewardAccentStrong}`;

                if (rewardGlow) {
                  rewardGlow.style.background = `radial-gradient(circle, ${rewardAccentAlpha} 0%, transparent 70%)`;
                }

                const revealDelay = props.revealDelayMs ?? 2200;
                const holdDuration = props.revealHoldMs ?? 5200;
                const overlayLifetime = Math.max(mils, revealDelay + holdDuration + 1200);

                const createParticles = () => {
                  particlesContainer.innerHTML = "";
                  const palette = [
                    rewardAccent,
                    rewardAccentLight,
                    glowSoft,
                    baseGlow
                  ];
                  const count = 42;
                  for (let i = 0; i < count; i += 1) {
                    const particle = document.createElement("span");
                    particle.className = "particle";
                    const angle = (Math.PI * 2 * i) / count;
                    const distance = 160 + Math.random() * 160;
                    const tx = Math.cos(angle) * distance;
                    const ty = Math.sin(angle) * distance;
                    particle.style.setProperty("--tx", `${tx}px`);
                    particle.style.setProperty("--ty", `${ty}px`);
                    const color = palette[Math.floor(Math.random() * palette.length)];
                    particle.style.background = color;
                    particle.style.boxShadow = `0 0 18px ${withOpacity(color, 0.6)}`;
                    particle.style.left = "50%";
                    particle.style.top = "35%";
                    particlesContainer.appendChild(particle);
                  }
                };

                const sequenceTimers: number[] = [];
                const queue = (delay: number, fn: () => void) => {
                  const timer = window.setTimeout(fn, Math.max(0, delay));
                  sequenceTimers.push(timer);
                  return timer;
                };

                const openingDuration = 1200;
                const shakeLead = 480;
                const openingStart = Math.max(0, revealDelay - openingDuration);
                const shakeStart = Math.max(0, openingStart - shakeLead);
                const flashStart = openingStart + 600;
                const flashEnd = flashStart + 600;
                const openedTime = openingStart + 840;

                queue(shakeStart, () => lootboxEl.classList.add("shake"));
                queue(openingStart, () => {
                  lootboxEl.classList.remove("shake");
                  lootboxEl.classList.add("opening");
                  createParticles();
                });
                queue(flashStart, () => flashOverlay.classList.add("flash"));
                queue(flashEnd, () => flashOverlay.classList.remove("flash"));
                queue(openedTime, () => lootboxEl.classList.add("opened"));

                const launchConfetti = () => {
                  ensureConfetti(() => {
                    const confettiFn = (window as any).confetti;
                    if (typeof confettiFn !== "function") {
                      return;
                    }
                    const defaults = {
                      origin: { y: 0.7 },
                      disableForReducedMotion: true,
                    };
                    const confettiColors = [
                      rewardAccent,
                      baseGlow,
                      props.valueColor,
                      accentLight,
                      "#ffffff"
                    ].filter(Boolean) as string[];
                    confettiFn({
                      ...defaults,
                      particleCount: 70,
                      spread: 65,
                      startVelocity: 45,
                      colors: confettiColors,
                    });
                    window.setTimeout(() => {
                      confettiFn({
                        ...defaults,
                        particleCount: 45,
                        spread: 120,
                        startVelocity: 60,
                        scalar: 0.9,
                        ticks: 220,
                        colors: confettiColors,
                      });
                    }, 220);
                  });
                };

                const revealTimer = window.setTimeout(() => {
                  container.classList.add("msgg-open");
                  lootboxEl.classList.add("opened");
                  rewardDisplay.classList.add("show");
                  rewardCard.classList.add("active");
                  launchConfetti();
                  rewardCard.style.borderColor = rewardAccent;
                  rewardCard.style.boxShadow = `0 32px 75px rgba(0,0,0,0.55), 0 0 65px ${rewardAccentStrong}, inset 0 0 35px rgba(255,255,255,0.08)`;
                  // @ts-ignore
                  sendWebsocketEvent(event.uuid, { result: selectedItem });
                }, revealDelay);

                const cleanupTimer = window.setTimeout(() => {
                  container.classList.add("msgg-finale");
                }, revealDelay + holdDuration);

                const clearTimers = () => {
                  window.clearTimeout(revealTimer);
                  window.clearTimeout(cleanupTimer);
                  sequenceTimers.forEach((timer) => window.clearTimeout(timer));
                  sequenceTimers.length = 0;
                };

                let hasRemoved = false;
                let removalTimeout: number | undefined;

                const scheduleRemoval = () => {
                  if (hasRemoved) {
                    return;
                  }
                  hasRemoved = true;
                  clearTimers();
                  if (removalTimeout !== undefined) {
                    window.clearTimeout(removalTimeout);
                  }
                  particlesContainer.innerHTML = "";
                  $(`#${event.uuid}`).remove();
                };

                removalTimeout = window.setTimeout(scheduleRemoval, overlayLifetime);

                container.addEventListener(
                  "DOMNodeRemoved",
                  () => {
                    clearTimers();
                    if (removalTimeout !== undefined) {
                      window.clearTimeout(removalTimeout);
                    }
                    particlesContainer.innerHTML = "";
                  },
                  { once: true }
                );
              }
              appendHtml();
            });
        },
      },
    },
  };
  return overlayLootBoxEffectType;
}
