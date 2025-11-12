/**
 * Different modes of lootbox and item selection
 */
export type SelectionMode = "list" | "manual";

/**
 * Actions that can be performed on a lootbox
 */
export type LootBoxManagerAction =
  | "open"
  | "addItem"
  | "editItem"
  | "removeItem"
  | "removeLootBox"
  | "adjustStock"
  | "editLootBox"
  | "reset";

export type OptionAliasMap = Record<string, string | string[]>;

export type ImageMode = "url" | "local";
export type StockOperation = "add" | "subtract";
export type TimingField = "lengthSeconds" | "revealDelayMs" | "revealHoldMs";
export type NullableNumber = number | null;
export type Numberish = number | string;
export type NullableNumberish = Numberish | null;

// ============================================================================
// Setting Update Types (Similar to Poll System)
// ============================================================================

/**
 * Types of settings that can be updated individually for loot boxes
 */
export type LootBoxSettingType = 
  | 'backgroundGradientStart'
  | 'backgroundGradientEnd'
  | 'glowColor'
  | 'accentColor'
  | 'textColor'
  | 'subtitleColor'
  | 'valueColor'
  | 'fontFamily'
  | 'hideBackground'
  | 'showConfetti'
  | 'revealDelayMs'
  | 'revealHoldMs'
  | 'lengthSeconds'
  | 'durationMs'
  | 'overlayInstance'
  | 'displayName';

/**
 * Types of settings that can be updated individually for items
 */
export type ItemSettingType = 
  | 'label'
  | 'value'
  | 'subtitle'
  | 'weight'
  | 'maxWins'
  | 'accentColor'
  | 'imageUrl'
  | 'imageFile';

/**
 * Setting update union type for loot boxes
 */
export type SettingUpdate = StyleSetting | BooleanSetting | NumberSetting | StringSetting;

/**
 * Setting update union type for items
 */
export type ItemSettingUpdate = ItemStringSetting | ItemNumberSetting | ItemNullableNumberSetting;

/**
 * Style (color) setting update
 */
export interface StyleSetting {
  type: 'backgroundGradientStart' | 'backgroundGradientEnd' | 'glowColor' | 
        'accentColor' | 'textColor' | 'subtitleColor' | 'valueColor';
  value: string;
}

/**
 * Boolean setting update
 */
export interface BooleanSetting {
  type: 'hideBackground' | 'showConfetti';
  value: boolean;
}

/**
 * Number setting update
 */
export interface NumberSetting {
  type: 'revealDelayMs' | 'revealHoldMs' | 'lengthSeconds' | 'durationMs';
  value: number;
}

/**
 * String setting update
 */
export interface StringSetting {
  type: 'fontFamily' | 'overlayInstance' | 'displayName';
  value: string;
}

/**
 * String setting update for items
 */
export interface ItemStringSetting {
  type: 'label' | 'value' | 'subtitle' | 'accentColor' | 'imageUrl' | 'imageFile';
  value: string;
}

/**
 * Number setting update for items
 */
export interface ItemNumberSetting {
  type: 'weight';
  value: number;
}

/**
 * Nullable number setting update for items
 */
export interface ItemNullableNumberSetting {
  type: 'maxWins';
  value: number | null;
}

// ============================================================================
// Visual Configuration
// ============================================================================

export interface LootBoxVisualConfig {
  imageMode?: ImageMode;
  imageUrl?: string;
  imageFile?: string;
  imageToken?: string;
  accentColor?: string;
}

// ============================================================================
// Item Definitions
// ============================================================================

export interface LootBoxItemCore {
  id?: string;
  label: string;
  value: string;
  subtitle?: string;
}

export interface LootBoxItemStats {
  weight: number;
  maxWins?: NullableNumber;
  wins?: number;
  remaining?: NullableNumber;
  lastWonAt?: string;
}

export type LootBoxItem = LootBoxItemCore & LootBoxItemStats & LootBoxVisualConfig;

export interface LootBoxInventoryItem extends LootBoxItem {
  id: string;
  maxWins: NullableNumber;
  wins: number;
  createdAt: string;
  updatedAt: string;
}

export type LootBoxSummaryItem = Pick<
  LootBoxInventoryItem,
  | "id"
  | "label"
  | "value"
  | "subtitle"
  | "weight"
  | "maxWins"
  | "wins"
  | "imageMode"
  | "imageUrl"
  | "imageFile"
  | "accentColor"
> &
  Required<Pick<LootBoxInventoryItem, "remaining">>;

export type LootBoxInventoryView = LootBoxInventoryItem &
  Required<Pick<LootBoxInventoryItem, "remaining">>;

// ============================================================================
// Loot Box Configuration
// ============================================================================

export interface LootBoxOverlaySettings {
  lengthSeconds: number;
  durationMs: number;
  overlayInstance?: string;
}

export type LootBoxSourceType = "list" | "file" | "variable" | "manager";
export type LootBoxEntrySource = Extract<LootBoxSourceType, "list" | "file" | "variable">;

export interface LootBoxRecord {
  id: string;
  displayName: string;
  source: LootBoxSourceType;
  props: LootBoxProps;
  items: Record<string, LootBoxInventoryItem>;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  lastSelectedItemId?: string;
  totalOpens: number;
  overlaySettings?: LootBoxOverlaySettings;
}

export interface LootBoxSelection {
  lootBoxId: string;
  item: LootBoxInventoryItem;
  timestamp: string;
}

export interface LootBoxProps {
  backgroundGradientStart: string;
  backgroundGradientEnd: string;
  hideBackground: boolean;
  glowColor: string;
  accentColor: string;
  textColor: string;
  subtitleColor: string;
  valueColor: string;
  fontFamily: string;
  revealDelayMs: number;
  revealHoldMs: number;
  showConfetti: boolean;
  items: LootBoxItem[];
}

// ============================================================================
// Effect Models
// ============================================================================

export interface EffectModel {
  lootBoxId: string;
  lootBoxDisplayName?: string;
  length: number;
  variable?: string;
  overlayInstance?: string;
  EventData: EventData;
  fileOrList: LootBoxEntrySource;
  filePath?: string;
  duration?: number;
}

/**
 * Enhanced manager effect model with setting support
 */
export interface LootBoxManagerEffectModel {
  selectionMode: SelectionMode;
  lootBoxId: string;
  lootBoxDisplay?: string;
  action: LootBoxManagerAction;
  itemId?: string;
  manualItemId?: string;
  itemDisplay?: string;
  label?: string;
  value?: string;
  subtitle?: string;
  weight?: Numberish;
  maxWins?: NullableNumberish;
  stockOperation?: StockOperation;
  stockAmount?: Numberish;
  imageMode?: ImageMode;
  imageUrl?: string;
  imageFile?: string;
  accentColor?: string;
  timingField?: TimingField;
  timingValue?: Numberish;
  confirmRemove?: string;
  boxDisplayName?: string;
  boxOverlayInstance?: string;
  boxOverlayDurationMs?: Numberish;
  boxLengthSeconds?: Numberish;
  boxRevealDelayMs?: Numberish;
  boxRevealHoldMs?: Numberish;
  boxBackgroundGradientStart?: string;
  boxBackgroundGradientEnd?: string;
  boxHideBackground?: boolean;
  boxGlowColor?: string;
  boxAccentColor?: string;
  boxTextColor?: string;
  boxSubtitleColor?: string;
  boxValueColor?: string;
  boxFontFamily?: string;
  boxShowConfetti?: boolean;
  
  // Individual setting updates
  setting?: SettingUpdate;
  itemSetting?: ItemSettingUpdate;
}

export interface EventData {
  overlayInstance?: string;
  lootBoxId?: string;
  uuid: string;
  length: number;
  props: LootBoxProps;
  duration: number;
  selectedItem?: LootBoxItem;
}

export interface EV<T = LootBoxItem> {
  name: string;
  data: {
    result: T;
  };
}