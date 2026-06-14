// Heads-up display: hotbar, block-picker inventory, and block icon rendering.
import { BLOCKS, BLOCK, tileFor, ATLAS_COLS, TILE_PX } from '../world/blocks.js';

// Blocks available to place, in inventory order.
export const PLACEABLE = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLE, BLOCK.SAND,
  BLOCK.GRAVEL, BLOCK.PLANKS, BLOCK.LOG, BLOCK.LEAVES, BLOCK.GLASS,
  BLOCK.BRICK, BLOCK.SNOW, BLOCK.PUMPKIN, BLOCK.CACTUS, BLOCK.WATER,
  BLOCK.COAL_ORE, BLOCK.IRON_ORE, BLOCK.GOLD_ORE, BLOCK.DIAMOND_ORE, BLOCK.BEDROCK,
];

export class HUD {
  constructor(atlasCanvas) {
    this.atlas = atlasCanvas;
    this.selected = 0;
    this.slots = [
      BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLE,
      BLOCK.PLANKS, BLOCK.LOG, BLOCK.LEAVES, BLOCK.GLASS, BLOCK.BRICK,
    ];
    this.inventoryOpen = false;
    this.onClose = null;
    this._buildHotbar();
    this._buildInventory();
  }

  iconDataURL(blockId, size = 36) {
    const tile = tileFor(blockId, 'side');
    const col = tile % ATLAS_COLS;
    const row = Math.floor(tile / ATLAS_COLS);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.atlas,
      col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX,
      0, 0, size, size
    );
    return c.toDataURL();
  }

  _buildHotbar() {
    const bar = document.getElementById('hotbar');
    bar.innerHTML = '';
    this.slotEls = [];
    for (let i = 0; i < this.slots.length; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const img = document.createElement('img');
      img.src = this.iconDataURL(this.slots[i]);
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = i + 1;
      slot.appendChild(img);
      slot.appendChild(num);
      slot.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.select(i);
      });
      bar.appendChild(slot);
      this.slotEls.push({ slot, img });
    }
    this._refreshHotbar();
  }

  _refreshHotbar() {
    this.slotEls.forEach((el, i) => {
      el.slot.classList.toggle('active', i === this.selected);
      el.img.src = this.iconDataURL(this.slots[i]);
    });
    const name = BLOCKS[this.slots[this.selected]]?.name ?? '';
    const label = document.getElementById('block-name');
    if (label) {
      label.textContent = name;
      label.classList.remove('flash');
      void label.offsetWidth;
      label.classList.add('flash');
    }
  }

  _buildInventory() {
    const inv = document.getElementById('inventory');
    inv.innerHTML = '<h2>Inventory — click a block to assign it to the selected hotbar slot</h2>';
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    for (const id of PLACEABLE) {
      const cell = document.createElement('div');
      cell.className = 'inv-cell';
      cell.title = BLOCKS[id]?.name ?? '';
      const img = document.createElement('img');
      img.src = this.iconDataURL(id, 48);
      const cap = document.createElement('span');
      cap.textContent = BLOCKS[id]?.name ?? '';
      cell.appendChild(img);
      cell.appendChild(cap);
      cell.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.slots[this.selected] = id;
        this._refreshHotbar();
        this.toggleInventory(false);
        this.onClose?.();
      });
      grid.appendChild(cell);
    }
    inv.appendChild(grid);
  }

  select(i) {
    this.selected = (i + this.slots.length) % this.slots.length;
    this._refreshHotbar();
  }

  scroll(delta) {
    this.select(this.selected + (delta > 0 ? 1 : -1));
  }

  currentBlock() {
    return this.slots[this.selected];
  }

  toggleInventory(force) {
    this.inventoryOpen = force ?? !this.inventoryOpen;
    document.getElementById('inventory').classList.toggle('open', this.inventoryOpen);
  }
}
