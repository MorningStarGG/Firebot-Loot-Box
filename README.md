# Advanced Loot Box System for Firebot

A comprehensive and feature-rich loot box system for Firebot, designed to provide cinematic, game-inspired reveals with full inventory management and persistent storage.

## Features

### Core Functionality

### Loot Box Creation & Management
- Create loot boxes with multiple prize items
- Three input modes:
  - Manual item entry with full configuration
  - JSON file import for bulk item setup
  - Variable-based item loading for dynamic content
- Persistent database storage for inventory tracking
- Automatic item selection with weighted probability
- Stock management with max wins limits
- Multiple loot box support with unique IDs
- Reset functionality to restore all items to full stock
- Automatic tracking of wins per item
- Last opened timestamp tracking

### Loot Box Manager Actions
- **Open Loot Box** - Selects and reveals the next winning item
- **Add Item** - Insert new rewards with full configuration
- **Edit Item** - Modify existing item properties
- **Remove Item** - Removes items and their history
- **Remove Loot Box** - Removes loot boxes and their items/history
- **Adjust Stock** - Add or subtract remaining quantity
- **Set Max Wins** - Change total win cap (blank = unlimited)
- **Set Weight** - Adjust probability of selection
- **Edit Timing** - Modify overlay and animation durations
- **Reset Loot Box** - Restore all items to original stock

### Item Management
- Label (display name on reveal)
- Subtitle (rarity tag or flavor text)
- Weight (probability multiplier)
- Max Wins (stock limit, null = unlimited)
- Individual accent colors per item
- Image support:
  - URL-based images
  - Local file images (automatically tokenized)
- Win tracking per item
- Remaining stock calculation
- Last won timestamp

## Display Features

### Visual Customization
- Custom background gradient (start and end colors)
- Optional background hiding for green screen
- Custom glow color for effects
- Custom accent color for boxes
- Custom text color for item names
- Custom value/subtitle color
- Custom item shadow color
- Custom font family selection:
  - Montserrat (default)
  - Orbitron
  - Poppins
  - Rajdhani
  - Russo One
  - Work Sans

### Timing Controls
- **Overlay Length** - Total time the overlay stays visible (seconds)
- **Build-up Delay** - Animation time before reveal (milliseconds)
- **Showcase Hold** - Display time after reveal (milliseconds)
- **Confetti Toggle** - Enable/disable celebration effects

### Positioning
- Custom positioning support
- Overlay instance support

## UI Elements

### Real-time UI Features
- Live inventory updates
- Stock tracking display
- Manager interface with:
  - Dropdown list mode for easy selection
  - Manual entry mode for command/variable use
  - Live inventory snapshot table
  - Current timing display
  - Action-specific forms
- Selection mode toggle (list vs manual)
- Automatic ID sanitization (converts to lowercase with hyphens)

### Inventory Snapshot Table
Shows real-time data:
- Item names
- Current wins
- Remaining stock (∞ for unlimited)
- Max wins limit

### Animations
The system includes cinematic animations for:
1. **Box Opening Sequence**:
   - Initial charge-up with glow effects
   - Shaking animation
   - Lid flying off with rotation
   - Particle explosion burst
   - Flash overlay effect

2. **Item Reveal**:
   - Smooth emergence animation
   - Card shine effects
   - Floating animation
   - Pulsing glow effects
   - Confetti celebration (optional)

3. **Visual Effects**:
   - Radial gradient backdrops
   - Dynamic shadow effects
   - Particle systems
   - Smooth transitions

## Technical Features

### Data Management
- SQLite database storage (db/lootbox.db)
- Automatic data persistence
- Win history tracking
- Item history tracking
- Last opened tracking
- Multiple loot box instance support
- Automatic cleanup of expired selections

### Weighted Selection
- Probability-based item selection
- Weight multiplier support (higher = more likely)
- Automatic filtering of depleted items
- Minimum weight enforcement (must be > 0)
- Fallback to last valid item if selection fails

### Effect Outputs
The Advanced Loot Box Manager provides:
- `winningItem` - Label of the selected item
- `remainingStock` - Remaining wins (blank if unlimited)

## Events

### Loot Box Events

- **Loot Box Opened** - Triggered when a box is opened and item selected
  - Metadata: lootBoxId, lootBoxName, itemId, itemLabel, itemValue, itemSubtitle, wins, remaining, maxWins, weight, totalOpens
  
- **Loot Box Item Won** - Triggered when item is successfully won (after reveal)
  - Metadata: All opened metadata plus isFirstWin flag
  
- **Loot Box Empty** - Triggered when trying to open with no available items
  - Metadata: lootBoxId, lootBoxName, totalItems, depletedItems, totalOpens
  
- **Loot Box Item Depleted** - Triggered when item reaches max wins
  - Metadata: lootBoxId, lootBoxName, itemId, itemLabel, itemValue, maxWins, totalOpens, remainingItems

## Variables

### Loot Box Information Variables

#### `$lootBoxes[fields?]`
Returns information about all loot boxes with configurable output.

**Examples:**
- `$lootBoxes[]` - Comma-separated IDs (default)
- `$lootBoxes[names]` - Display names list
- `$lootBoxes[count]` - Total number of loot boxes
- `$lootBoxes[ids, names, opens]` - Combined information
- `$lootBoxes[detailed]` - IDs, names, and opens together
- `$lootBoxes[raw]` - Raw array for advanced processing

#### `$lootBoxInfo[lootBoxId, fields?]`
Returns configurable details for a single loot box.

**Examples:**
- `$lootBoxInfo[grand_prize]` - Name and opens (default)
- `$lootBoxInfo[grand_prize, displayName]` - Just the name
- `$lootBoxInfo[grand_prize, totalOpens]` - Just open count
- `$lootBoxInfo[grand_prize, itemCount]` - Total items
- `$lootBoxInfo[grand_prize, availableCount]` - Available items
- `$lootBoxInfo[grand_prize, exists]` - Returns 'true' or 'false'
- `$lootBoxInfo[grand_prize, pending]` - Has pending selection
- `$lootBoxInfo[grand_prize, raw]` - Raw record object

#### `$lootBoxInventory[lootBoxId, fields?]`
Returns formatted inventory information with flexible filtering.

**Examples:**
- `$lootBoxInventory[grand_prize]` - Item names (default)
- `$lootBoxInventory[grand_prize, ids]` - Item IDs
- `$lootBoxInventory[grand_prize, values]` - Item values
- `$lootBoxInventory[grand_prize, count]` - Total items
- `$lootBoxInventory[grand_prize, available]` - Available count
- `$lootBoxInventory[grand_prize, names, remaining]` - Names with stock
- `$lootBoxInventory[grand_prize, names, wins]` - Names with wins
- `$lootBoxInventory[grand_prize, names, weights]` - Names with weights
- `$lootBoxInventory[grand_prize, detailed]` - Full information
- `$lootBoxInventory[grand_prize, onlyAvailable]` - Filter to in-stock items
- `$lootBoxInventory[grand_prize, raw]` - Raw array

#### `$lootBoxItem[lootBoxId, itemId, fields?]`
Returns detailed information about a specific item.

**Examples:**
- `$lootBoxItem[grand_prize, legend_sword]` - Label and value (default)
- `$lootBoxItem[grand_prize, legend_sword, label]` - Just label
- `$lootBoxItem[grand_prize, legend_sword, value]` - Just value
- `$lootBoxItem[grand_prize, legend_sword, wins]` - Win count
- `$lootBoxItem[grand_prize, legend_sword, remaining]` - Stock remaining
- `$lootBoxItem[grand_prize, legend_sword, weight]` - Item weight
- `$lootBoxItem[grand_prize, legend_sword, available]` - 'true' or 'false'
- `$lootBoxItem[grand_prize, legend_sword, lastWon]` - Last won timestamp
- `$lootBoxItem[grand_prize, legend_sword, raw]` - Raw object

#### `$lootBoxFind[type, query, fields?]`
Search for loot boxes and items with flexible criteria.

**Search Types:**
- `boxes` - Find loot boxes by name/ID
- `items` - Find items across all boxes
- `itemsIn` - Find items in specific box
- `contains` - Find boxes containing specific item
- `available` - Find boxes with available items
- `empty` - Find empty/depleted boxes
- `minItems` - Find boxes with minimum item count
- `minOpens` - Find boxes with minimum opens
- `opened` - Find boxes that have been opened
- `pending` - Find boxes with pending selections
- `hasItems` - Find boxes with items defined

**Examples:**
- `$lootBoxFind[boxes, treasure]` - Boxes matching "treasure"
- `$lootBoxFind[items, sword]` - All items with "sword"
- `$lootBoxFind[itemsIn, grand_prize, sword]` - Swords in specific box
- `$lootBoxFind[contains, mythic-blade]` - Boxes with specific item
- `$lootBoxFind[available, true]` - Boxes with available items
- `$lootBoxFind[minItems, 5]` - Boxes with 5+ items
- `$lootBoxFind[raw]` - Raw data output

#### `$lootBoxLastSelection[lootBoxId, fields?]`
Returns information about the most recent selection.

**Examples:**
- `$lootBoxLastSelection[grand_prize]` - Item label (default)
- `$lootBoxLastSelection[grand_prize, id]` - Item ID
- `$lootBoxLastSelection[grand_prize, value]` - Item value
- `$lootBoxLastSelection[grand_prize, id, label, value]` - All info
- `$lootBoxLastSelection[grand_prize, raw]` - Raw object

### Variable Display Options
- Multiple formatting options for each variable
- Customizable output formats
- Support for raw data output for advanced processing
- Comma-separated and pipe-separated list formats

## Usage

### Creating a Loot Box
1. Add the "Advanced Loot Box" effect to any effect list
2. Configure the loot box identity:
   - Set a unique Loot Box ID (letters, numbers, hyphens, underscores)
   - Optionally set a display name
3. Configure timing and behavior:
   - Set overlay length (how long it stays visible)
   - Set build-up delay (animation before reveal)
   - Set showcase hold (how long to display winner)
   - Toggle confetti on/off
4. Customize the visual style:
   - Set background gradient colors
   - Choose glow, accent, and text colors
   - Select font family
   - Toggle background visibility
5. Add loot items:
   - Enter manually with full configuration
   - Import from JSON file
   - Use a variable for dynamic content
6. Configure positioning and overlay instance

### Managing a Loot Box
1. Add the "Advanced Loot Box Manager" effect
2. Choose selection mode:
   - **List Mode**: Select from dropdown of existing boxes
   - **Manual Mode**: Enter loot box ID directly (for commands/variables)
3. Select the target loot box
4. Choose an action:
   - Open (pre-selects winner, run before overlay effect)
   - Add/Edit/Remove items
   - Adjust stock or set limits
   - Edit timing settings
   - Reset entire box
5. Configure action-specific settings

### Opening Workflow
**Recommended Approach:**
1. Use Manager effect to "Open Loot Box" - this selects the winner
2. Winner is stored as a pending selection for 5 minutes

**Alternative Approach:**
Configure items directly in the overlay effect, which will:
- Sync items to the database
- Auto-select a winner if no pending selection exists
- Display the reveal

### Tips and Best Practices
1. Use descriptive loot box IDs for easier management
2. Test visibility and positioning before going live
3. Use variables for dynamic loot box creation
4. Set appropriate max wins to prevent item depletion
5. Use weights to control rarity (1 = common, higher = rarer)
6. Organize items by rarity using accent colors
7. Consider overlay layout when positioning boxes
8. Use subtitle field for rarity tags (Epic, Legendary, etc.)

### Known Limitations
- Pending selections expire after 5 minutes of inactivity
- Maximum items limited by display space and memory
- Some animations may impact performance on lower-end systems
- Local image files must be accessible to Firebot

## Installation

### Script Installation
1. Download the script files or build from source (see Building section)
2. **Place the Script in Firebot Scripts Folder**
   - In Firebot, navigate to **Settings > Scripts > Manage Startup Scripts**
   - Click **Add New Script**
   - In the blue notification bar, click the link labeled **scripts folder**
   - Copy the downloaded script into this folder
   - Hit the **refresh button** beside the **Select script** dropdown
   - Select **MSGG-LootBox.js** from the dropdown menu
   - Click **Save**
3. The script will add two new effects:
   - Advanced Loot Box (overlay effect)
   - Advanced Loot Box Manager (management effect)
4. The script will also add four new events:
   - Loot Box Opened
   - Loot Box Item Won
   - Loot Box Empty
   - Loot Box Item Depleted
5. Six variables will be registered:
   - $lootBoxes
   - $lootBoxInfo
   - $lootBoxInventory
   - $lootBoxItem
   - $lootBoxFind
   - $lootBoxLastSelection

### Building

1. Clone the repository:
```
git clone https://github.com/MorningStarGG/Firebot-Loot-Box.git
```
2. Install dependencies:
```
npm install
```
3. Build the script:
```
npm run build:prod
```

## Loot Item JSON Schema

When supplying items via file or variable, provide an array with the following structure:

```json
[
  {
    "id": "mythic_blade",
    "label": "Mythic Blade",
    "subtitle": "Legendary Drop",
    "value": "!give mythic_blade",
    "weight": 1,
    "maxWins": 5,
    "imageMode": "url",
    "imageUrl": "https://example.com/blade.png",
    "accentColor": "#ff4ecd"
  },
  {
    "label": "Credits",
    "value": "500 credits",
    "subtitle": "Common Reward",
    "weight": 10,
    "maxWins": null,
    "imageMode": "local",
    "imageFile": "C:/firebot/assets/credits.png",
    "accentColor": "#ffd700"
  }
]
```

### Field Descriptions
- `id` - Optional unique identifier (auto-generated if not provided)
- `label` - Display name shown on reveal (required)
- `value` - Command output or reward value (required)
- `subtitle` - Optional rarity tag or flavor text
- `weight` - Probability multiplier (default: 1, must be > 0)
- `maxWins` - Total times item can be won (null or omit for unlimited)
- `imageMode` - "url" or "local" (default: "url")
- `imageUrl` - HTTP/HTTPS URL to image (for url mode)
- `imageFile` - Full file path to image (for local mode)
- `accentColor` - Hex color code for item highlight (optional)

## Performance Considerations

### Optimization Tips
1. Use appropriate image sizes (recommended: 256x256 or 512x512)
2. Keep overlay length reasonable (10-20 seconds recommended)
3. Clean up ended loot boxes periodically using Manager to remove or reset lootboxes

### Database Maintenance
- Database grows with usage (wins, timestamps, etc.)
- Periodically backup db/lootbox.db
- Consider resetting or removing loot boxes that are no longer used
- Monitor database size if running long-term

## Technical Support

### Troubleshooting

#### Loot Box Not Displaying
1. Check that the Firebot overlay is loaded in your streaming software
2. Verify the selected overlay instance matches your configuration
3. Check the position settings
4. Verify overlay length is sufficient for animations

#### Items Not Appearing
1. Ensure items have weight > 0
2. Check that items have remaining stock (maxWins not exceeded)
3. Verify the loot box ID matches between Manager and overlay effects
4. Check that the items array is not empty

#### Images Not Loading
1. For URL images: Verify the URL is accessible and returns an image
2. For local images: Ensure the file path is correct and accessible to Firebot
3. Check file format is supported (PNG, JPG, GIF, WEBP, SVG)
4. Verify resource token generation is working (check Firebot logs)

#### Database Issues
1. Check that db/lootbox.db is being created in scripts directory
2. Verify write permissions for the database directory
3. Check Firebot logs for database errors
4. If corrupted, delete db/lootbox.db (will reset all loot boxes)

### Requirements
- Firebot 5.64.0 or higher

### Support
For issues, questions, or feature requests:
- Open an issue on GitHub
- Join the Firebot Discord server

## License

This script is provided as-is under the GPL-3.0 license. You are free to modify and distribute it according to your needs.

## Credits

Original codebase by CKY from his Spin Wheel script. May you rest in peace, my friend. You made many things in Firebot possible for many more.

## Acknowledgments

Special thanks to the Firebot community for their support and contributions.

---
 
**AI Disclaimer:** Parts of this was made with various AI tools to speed development time.