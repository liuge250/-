/**
 * 传奇地图解析器 - 基于 Crystal 源码的 Map.cs
 * 支持多种 .map 文件格式
 */

import * as fs from 'fs';
import * as path from 'path';

// 地图格子属性
export enum CellAttribute {
  Walk = 0,      // 可行走
  HighWall = 1,  // 高墙（可越过攻击）
  LowWall = 2,   // 低墙（不可越过）
}

export interface MapCell {
  attribute: CellAttribute;
  door: number;
  light: number;
}

export interface ParsedMap {
  width: number;
  height: number;
  cells: MapCell[][];
  walkableCells: { x: number; y: number }[];
}

/**
 * 检测地图文件格式
 */
function findType(data: Buffer): number {
  // C# custom map format
  if (data[2] === 0x43 && data[3] === 0x23) return 100;
  // wemade mir3 maps - start with blank bytes
  if (data[0] === 0) return 5;
  // shanda mir3 maps - start with (C) SNDA, MIR3
  if (data[0] === 0x0F && data[5] === 0x53 && data[14] === 0x33) return 6;
  // wemades antihack map - Mir2 AntiHack
  if (data[0] === 0x15 && data[4] === 0x32 && data[6] === 0x41 && data[19] === 0x31) return 4;
  // wemades 2010 map format - Map 2010 Ver 1.0
  if (data[0] === 0x10 && data[2] === 0x61 && data[7] === 0x31 && data[14] === 0x31) return 1;
  // shanda's 2012 format
  if ((data[4] === 0x0F || data[4] === 0x03) && data[18] === 0x0D && data[19] === 0x0A) {
    const w = data[0] + (data[1] << 8);
    const h = data[2] + (data[3] << 8);
    if (data.length > 52 + w * h * 14) return 3;
    return 2;
  }
  // 3/4 heroes map format
  if (data[0] === 0x0D && data[1] === 0x4C && data[7] === 0x20 && data[11] === 0x6D) return 7;
  return 0;
}

/**
 * 解析 v0 格式地图
 */
function loadMapCellsv0(data: Buffer): ParsedMap {
  let offset = 0;
  const width = data.readInt16LE(offset); offset += 2;
  const height = data.readInt16LE(offset); offset += 2;

  const cells: MapCell[][] = [];
  const walkableCells: { x: number; y: number }[] = [];

  offset = 52;

  for (let x = 0; x < width; x++) {
    cells[x] = [];
    for (let y = 0; y < height; y++) {
      let attr = CellAttribute.Walk;

      const val1 = data.readInt16LE(offset); offset += 2;
      if ((val1 & 0x8000) !== 0) attr = CellAttribute.HighWall;

      const val2 = data.readInt16LE(offset); offset += 2;
      if ((val2 & 0x8000) !== 0) attr = CellAttribute.LowWall;

      const val3 = data.readInt16LE(offset); offset += 2;
      if ((val3 & 0x8000) !== 0) attr = CellAttribute.HighWall;

      const door = data[offset]; offset += 1;
      offset += 2; // skip
      const light = data[offset]; offset += 1;

      if (attr === CellAttribute.Walk) {
        walkableCells.push({ x, y });
      }

      cells[x][y] = { attribute: attr, door, light };
    }
  }

  return { width, height, cells, walkableCells };
}

/**
 * 解析 v1 格式地图 (Map 2010 Ver 1.0)
 */
function loadMapCellsv1(data: Buffer): ParsedMap {
  let offset = 21;

  const w = data.readInt16LE(offset); offset += 2;
  const xor = data.readInt16LE(offset); offset += 2;
  const h = data.readInt16LE(offset);

  const width = w ^ xor;
  const height = h ^ xor;

  const cells: MapCell[][] = [];
  const walkableCells: { x: number; y: number }[] = [];

  offset = 54;

  for (let x = 0; x < width; x++) {
    cells[x] = [];
    for (let y = 0; y < height; y++) {
      let attr = CellAttribute.Walk;

      const val1 = data.readInt32LE(offset) ^ 0xAA38AA38;
      offset += 6;
      if ((val1 & 0x20000000) !== 0) attr = CellAttribute.HighWall;

      const val2 = data.readInt16LE(offset) ^ xor;
      offset += 2;
      if ((val2 & 0x8000) !== 0) attr = CellAttribute.LowWall;

      const door = data[offset]; offset += 1;
      offset += 4; // skip
      const light = data[offset]; offset += 1;
      offset += 1; // skip

      if (attr === CellAttribute.Walk) {
        walkableCells.push({ x, y });
      }

      cells[x][y] = { attribute: attr, door, light };
    }
  }

  return { width, height, cells, walkableCells };
}

/**
 * 解析 v2 格式地图
 */
function loadMapCellsv2(data: Buffer): ParsedMap {
  let offset = 0;
  const width = data.readInt16LE(offset); offset += 2;
  const height = data.readInt16LE(offset); offset += 2;

  const cells: MapCell[][] = [];
  const walkableCells: { x: number; y: number }[] = [];

  for (let x = 0; x < width; x++) {
    cells[x] = [];
    for (let y = 0; y < height; y++) {
      let attr = CellAttribute.Walk;

      // 简化版 v2 解析
      const val = data.readInt32LE(offset);
      offset += 4;
      if ((val & 0x80000000) !== 0) attr = CellAttribute.HighWall;

      const val2 = data.readInt16LE(offset);
      offset += 2;
      if ((val2 & 0x8000) !== 0) attr = CellAttribute.LowWall;

      offset += 6; // skip remaining
      const door = data[offset - 4];
      const light = data[offset - 2];

      if (attr === CellAttribute.Walk) {
        walkableCells.push({ x, y });
      }

      cells[x][y] = { attribute: attr, door, light };
    }
  }

  return { width, height, cells, walkableCells };
}

/**
 * 解析 .map 文件
 */
export function parseMapFile(filePath: string): ParsedMap | null {
  try {
    const data = fs.readFileSync(filePath);
    if (data.length < 20) return null;

    const type = findType(data);

    switch (type) {
      case 0: return loadMapCellsv0(data);
      case 1: return loadMapCellsv1(data);
      case 2:
      case 3: return loadMapCellsv2(data);
      default:
        console.log(`[MapParser] 不支持的地图格式: type=${type}, file=${filePath}`);
        return null;
    }
  } catch (err) {
    console.error(`[MapParser] 解析地图失败: ${filePath}`, err);
    return null;
  }
}

/**
 * 批量解析所有地图文件
 */
export function parseAllMaps(mapsDir: string): Map<string, ParsedMap> {
  const maps = new Map<string, ParsedMap>();

  if (!fs.existsSync(mapsDir)) {
    console.log(`[MapParser] 地图目录不存在: ${mapsDir}`);
    return maps;
  }

  const files = fs.readdirSync(mapsDir).filter(f => f.endsWith('.map'));

  for (const file of files) {
    const mapId = path.basename(file, '.map');
    const filePath = path.join(mapsDir, file);
    const parsed = parseMapFile(filePath);

    if (parsed) {
      maps.set(mapId, parsed);
    }
  }

  console.log(`[MapParser] 成功解析 ${maps.size}/${files.length} 张地图`);
  return maps;
}

/**
 * 将地图转换为可行走的网格（用于客户端渲染）
 */
export function mapToWalkableGrid(map: ParsedMap): number[][] {
  const grid: number[][] = [];
  for (let x = 0; x < map.width; x++) {
    grid[x] = [];
    for (let y = 0; y < map.height; y++) {
      grid[x][y] = map.cells[x][y].attribute === CellAttribute.Walk ? 1 : 0;
    }
  }
  return grid;
}
