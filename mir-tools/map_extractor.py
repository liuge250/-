#!/usr/bin/env python3
"""
传奇 DAT 地图数据解析工具
========================
解析传奇客户端的 .map 文件 (地图数据)

传奇地图文件格式:
    - 文件头: 包含地图尺寸、标题等
    - 地图块数据: 每个格子包含地砖索引、遮挡、光照等信息

使用方法:
    python map_extractor.py <map文件路径> [输出目录]
"""

import struct
import os
import sys
import json

try:
    from PIL import Image
except ImportError:
    print("需要安装 Pillow: pip install Pillow")
    sys.exit(1)


class MirMapParser:
    """传奇地图解析器"""

    # 地图块大小 (每个 tile 的像素尺寸)
    TILE_SIZE = 48  # 传奇默认 tile 大小

    def __init__(self, filepath: str):
        self.filepath = filepath
        self.file_data: bytes = b''
        self.file_size = 0

        # 地图信息
        self.width = 0
        self.height = 0
        self.title = ''
        self.tiles: list[list[dict]] = []

    def load(self):
        """加载地图文件"""
        with open(self.filepath, 'rb') as f:
            self.file_data = f.read()
        self.file_size = len(self.file_data)

    def parse_header(self) -> dict:
        """解析地图文件头"""
        if self.file_size < 20:
            raise ValueError("文件太小, 不是有效的地图文件")

        # 尝试不同的地图格式
        # 格式1: 标准传奇地图 (Wemade)
        # 读取标题 (通常在前几个字节)
        try:
            # 读取地图宽度 (offset 0, uint16)
            self.width = struct.unpack_from('<H', self.file_data, 0)[0]
            # 读取地图高度 (offset 2, uint16)
            self.height = struct.unpack_from('<H', self.file_data, 2)[0]

            # 合理性检查
            if self.width > 0 and self.height > 0 and self.width < 10000 and self.height < 10000:
                print(f"  地图尺寸: {self.width} x {self.height}")
                return {'width': self.width, 'height': self.height}
        except struct.error:
            pass

        # 格式2: 尝试 uint32
        try:
            self.width = struct.unpack_from('<I', self.file_data, 0)[0]
            self.height = struct.unpack_from('<I', self.file_data, 4)[0]
            if self.width > 0 and self.height > 0 and self.width < 10000 and self.height < 10000:
                print(f"  地图尺寸 (32-bit): {self.width} x {self.height}")
                return {'width': self.width, 'height': self.height}
        except struct.error:
            pass

        raise ValueError(f"无法解析地图文件头 (文件大小: {self.file_size})")

    def parse_tiles(self, header_info: dict) -> list[list[dict]]:
        """解析地图块数据"""
        width = header_info['width']
        height = header_info['height']

        # 计算数据区偏移 (跳过文件头)
        # 不同引擎的头部大小不同, 尝试自动检测
        data_offset = self._detect_data_offset(width, height)
        print(f"  数据区偏移: {data_offset}")

        tiles = []
        pos = data_offset

        for y in range(height):
            row = []
            for x in range(width):
                tile = self._read_tile(pos)
                if tile is None:
                    break
                row.append(tile)
                pos += tile['size']
            if row:
                tiles.append(row)

        self.tiles = tiles
        return tiles

    def _detect_data_offset(self, width: int, height: int) -> int:
        """自动检测数据区起始偏移"""
        # 常见的头部大小
        candidates = [4, 8, 12, 16, 20, 24, 40, 48, 100, 120, 200, 256]
        tile_size = 14  # 标准 tile 大小 (字节)
        expected_data_size = width * height * tile_size

        for offset in candidates:
            remaining = self.file_size - offset
            if remaining >= expected_data_size * 0.8:  # 允许一些误差
                return offset

        # 默认返回 20
        return min(20, self.file_size)

    def _read_tile(self, offset: int) -> dict | None:
        """读取单个地图块数据"""
        if offset + 14 > self.file_size:
            return None

        try:
            # 标准传奇 tile 结构 (14 bytes)
            # 具体字段含义取决于引擎版本
            data = self.file_data[offset:offset + 14]

            # 解析基本字段
            bg_index = struct.unpack_from('<H', data, 0)[0]   # 背景地砖索引
            mid_index = struct.unpack_from('<H', data, 2)[0]  # 中间层索引
            fg_index = struct.unpack_from('<H', data, 4)[0]   # 前景层索引
            door_index = struct.unpack_from('<H', data, 6)[0]  # 门索引
            block = data[8]  # 阻挡标记
            light = data[9]  # 光照

            return {
                'bg_index': bg_index,
                'mid_index': mid_index,
                'fg_index': fg_index,
                'door_index': door_index,
                'block': bool(block),
                'light': light,
                'size': 14,
            }
        except (struct.error, IndexError):
            return None

    def generate_minimap(self, output_path: str, scale: int = 2) -> str:
        """生成小地图预览"""
        if not self.tiles:
            print("  没有地图数据, 无法生成小地图")
            return ''

        height = len(self.tiles)
        width = max(len(row) for row in self.tiles) if self.tiles else 0

        if width == 0 or height == 0:
            print("  地图数据为空")
            return ''

        img_width = width * scale
        img_height = height * scale
        img = Image.new('RGB', (img_width, img_height), (0, 0, 0))
        pixels = img.load()

        for y, row in enumerate(self.tiles):
            for x, tile in enumerate(row):
                # 根据地砖索引生成颜色
                bg = tile['bg_index']
                if tile['block']:
                    color = (80, 80, 80)  # 阻挡区域 - 灰色
                elif bg == 0:
                    color = (0, 0, 0)  # 空地 - 黑色
                else:
                    # 根据索引生成不同颜色
                    r = (bg * 37) % 200 + 55
                    g = (bg * 73) % 180 + 40
                    b = (bg * 113) % 160 + 30
                    color = (r, g, b)

                # 填充 scale x scale 的像素块
                for dy in range(scale):
                    for dx in range(scale):
                        px = x * scale + dx
                        py = y * scale + dy
                        if px < img_width and py < img_height:
                            pixels[px, py] = color

        img.save(output_path, 'PNG')
        print(f"  小地图: {output_path} ({img_width}x{img_height})")
        return output_path

    def export_tiled(self, output_path: str):
        """导出为 Tiled Map Editor 格式 (JSON)"""
        if not self.tiles:
            return

        height = len(self.tiles)
        width = max(len(row) for row in self.tiles) if self.tiles else 0

        # 构建 Tiled 格式的图层数据
        bg_layer = []
        block_layer = []

        for y in range(height):
            for x in range(width):
                if x < len(self.tiles[y]):
                    tile = self.tiles[y][x]
                    bg_layer.append(tile['bg_index'] + 1)  # Tiled 从 1 开始
                    block_layer.append(1 if tile['block'] else 0)
                else:
                    bg_layer.append(0)
                    block_layer.append(0)

        tiled_map = {
            'compressionlevel': -1,
            'height': height,
            'width': width,
            'tilewidth': self.TILE_SIZE,
            'tileheight': self.TILE_SIZE,
            'infinite': False,
            'layers': [
                {
                    'data': bg_layer,
                    'height': height,
                    'width': width,
                    'id': 0,
                    'name': 'Background',
                    'opacity': 1,
                    'type': 'tilelayer',
                    'visible': True,
                    'x': 0,
                    'y': 0,
                },
                {
                    'data': block_layer,
                    'height': height,
                    'width': width,
                    'id': 1,
                    'name': 'Blocking',
                    'opacity': 0.5,
                    'type': 'tilelayer',
                    'visible': True,
                    'x': 0,
                    'y': 0,
                },
            ],
            'nextlayerid': 2,
            'nextobjectid': 1,
            'orientation': 'orthogonal',
            'renderorder': 'right-down',
            'tiledversion': '1.10.0',
            'type': 'map',
            'version': '1.10',
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(tiled_map, f, ensure_ascii=False, indent=2)

        print(f"  Tiled 格式: {output_path}")


# ============================================================
# 命令行入口
# ============================================================
def main():
    if len(sys.argv) < 2:
        print("传奇 DAT/MAP 地图数据解析工具")
        print("=" * 40)
        print(f"用法: python {sys.argv[0]} <map文件> [输出目录]")
        print()
        print("示例:")
        print(f"  python {sys.argv[0]} 0.map output/maps")
        print(f"  python {sys.argv[0]} 350.map output/maps")
        sys.exit(0)

    map_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else 'output/maps'

    if not os.path.exists(map_path):
        print(f"错误: 地图文件不存在: {map_path}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    print(f"加载地图: {map_path}")
    parser = MirMapParser(map_path)
    parser.load()
    print(f"  文件大小: {parser.file_size:,} bytes")

    try:
        header = parser.parse_header()
        tiles = parser.parse_tiles(header)
        print(f"  解析地图块: {len(tiles)} 行")

        # 生成小地图
        map_name = os.path.splitext(os.path.basename(map_path))[0]
        minimap_path = os.path.join(output_dir, f'{map_name}_minimap.png')
        parser.generate_minimap(minimap_path)

        # 导出 Tiled 格式
        tiled_path = os.path.join(output_dir, f'{map_name}.json')
        parser.export_tiled(tiled_path)

        # 保存原始数据
        raw_path = os.path.join(output_dir, f'{map_name}_raw.json')
        raw_data = {
            'width': header['width'],
            'height': header['height'],
            'tile_size': parser.TILE_SIZE,
            'tiles_count': sum(len(row) for row in tiles),
        }
        with open(raw_path, 'w', encoding='utf-8') as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=2)

        print(f"\n解析完成!")

    except ValueError as e:
        print(f"解析错误: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
