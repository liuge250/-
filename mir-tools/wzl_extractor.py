#!/usr/bin/env python3
"""
传奇 WZL/WZX 素材提取工具
========================
从传奇客户端的 .wzl/.wzx 文件中提取图片资源为 PNG 格式

使用方法:
    python wzl_extractor.py <wzl文件路径> [wzx文件路径] [输出目录]

WZX 文件格式:
    - 0~43: 标题 (44 bytes)
    - 44~47: 图片数量 (uint32)
    - 48+: 偏移量数组 (每个 uint32, 指向 WZL 中对应图片的位置)

WZL 文件格式:
    - 0~43: 标题 (44 bytes)
    - 44~47: 图片数量 (uint32)
    - 在 WZX 指定的偏移位置处: IMAGE 结构 + 像素数据

IMAGE 结构 (16 bytes):
    - byte  pixelFormat   (位深: 8=8bit调色板, 16=16bit RGB565)
    - byte  compressed    (是否 zlib 压缩)
    - byte  reserve
    - byte  compressLevel (压缩等级)
    - short width
    - short height
    - short x             (绘制偏移X)
    - short y             (绘制偏移Y)
    - int   size          (像素数据长度)
"""

import struct
import zlib
import os
import sys
import json
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("需要安装 Pillow: pip install Pillow")
    sys.exit(1)


# ============================================================
# 传奇标准调色板 (256色, 8-bit 索引模式使用)
# 来源: Delphi TPixelFormat 枚举, 传奇客户端内置
# ============================================================
MIR_PALETTE = [
    (0, 0, 0), (128, 0, 0), (0, 128, 0), (128, 128, 0),
    (0, 0, 128), (128, 0, 128), (0, 128, 128), (192, 192, 192),
    (85, 128, 151), (157, 185, 200), (123, 115, 115), (45, 41, 41),
    (90, 82, 82), (99, 90, 90), (66, 57, 57), (29, 24, 24),
    (24, 16, 16), (41, 24, 24), (16, 8, 8), (242, 121, 113),
    (225, 103, 95), (255, 90, 90), (255, 49, 49), (214, 90, 82),
    (148, 16, 0), (148, 41, 24), (57, 8, 0), (115, 16, 0),
    (181, 24, 0), (189, 99, 82), (66, 24, 16), (255, 170, 153),
    (90, 16, 0), (115, 57, 41), (165, 74, 49), (148, 123, 115),
    (189, 82, 49), (82, 33, 16), (123, 49, 24), (45, 24, 16),
    (140, 74, 49), (148, 41, 0), (189, 49, 0), (198, 115, 82),
    (107, 49, 24), (198, 107, 66), (206, 74, 0), (165, 99, 57),
    (90, 49, 24), (42, 16, 0), (21, 8, 0), (58, 24, 0),
    (8, 0, 0), (41, 0, 0), (74, 0, 0), (157, 0, 0),
    (220, 0, 0), (222, 0, 0), (251, 0, 0), (156, 115, 82),
    (148, 107, 74), (115, 74, 41), (82, 49, 24), (140, 74, 24),
    (136, 68, 17), (74, 33, 0), (33, 24, 16), (214, 148, 90),
    (198, 107, 33), (239, 107, 0), (255, 119, 0), (165, 148, 132),
    (66, 49, 33), (24, 16, 8), (41, 24, 8), (33, 16, 0),
    (57, 41, 24), (140, 99, 57), (66, 41, 16), (107, 66, 24),
    (123, 74, 24), (148, 74, 0), (140, 132, 123), (107, 99, 90),
    (74, 66, 57), (41, 33, 24), (70, 57, 41), (181, 165, 148),
    (123, 107, 90), (206, 177, 148), (165, 140, 115), (140, 115, 90),
    (181, 148, 115), (214, 165, 115), (239, 165, 74), (239, 198, 140),
    (123, 99, 66), (107, 86, 57), (189, 148, 90), (99, 57, 0),
    (214, 198, 173), (82, 66, 41), (148, 99, 24), (239, 214, 173),
    (165, 140, 99), (99, 90, 74), (189, 165, 123), (90, 66, 24),
    (189, 140, 49), (53, 49, 41), (148, 132, 99), (123, 107, 74),
    (165, 140, 90), (90, 74, 41), (156, 123, 57), (66, 49, 16),
    (239, 173, 33), (24, 16, 0), (41, 33, 0), (156, 107, 0),
    (148, 132, 90), (82, 66, 24), (107, 90, 41), (123, 99, 33),
    (156, 123, 33), (222, 165, 0), (90, 82, 57), (49, 41, 16),
    (206, 189, 123), (99, 90, 57), (148, 132, 74), (198, 165, 41),
    (16, 156, 24), (66, 140, 74), (49, 140, 66), (16, 148, 41),
    (8, 24, 16), (8, 24, 24), (8, 41, 16), (24, 66, 41),
    (165, 181, 173), (107, 115, 115), (24, 41, 41), (24, 66, 74),
    (49, 66, 74), (99, 198, 222), (68, 221, 255), (140, 214, 239),
    (115, 107, 57), (247, 222, 57), (247, 239, 140), (247, 231, 0),
    (107, 107, 90), (90, 140, 165), (57, 181, 239), (74, 156, 206),
    (49, 132, 181), (49, 82, 107), (222, 222, 214), (189, 189, 181),
    (140, 140, 132), (247, 247, 222), (0, 8, 24), (8, 24, 57),
    (8, 16, 41), (8, 24, 0), (8, 41, 0), (0, 82, 165),
    (0, 123, 222), (16, 41, 74), (16, 57, 107), (16, 82, 140),
    (33, 90, 165), (16, 49, 90), (16, 66, 132), (49, 82, 132),
    (24, 33, 49), (74, 90, 123), (82, 107, 165), (41, 57, 99),
    (16, 74, 222), (41, 41, 33), (74, 74, 57), (41, 41, 24),
    (74, 74, 41), (123, 123, 66), (156, 156, 74), (90, 90, 41),
    (66, 66, 20), (57, 57, 0), (89, 89, 0), (202, 53, 44),
    (107, 115, 33), (41, 49, 0), (49, 57, 16), (49, 57, 24),
    (66, 74, 0), (82, 99, 24), (90, 115, 41), (49, 74, 24),
    (24, 33, 0), (24, 49, 0), (24, 57, 16), (99, 132, 74),
    (107, 189, 74), (99, 181, 74), (99, 189, 74), (90, 156, 74),
    (74, 140, 57), (99, 198, 74), (99, 214, 74), (82, 132, 74),
    (49, 115, 41), (99, 198, 90), (82, 189, 74), (16, 255, 0),
    (24, 41, 24), (74, 136, 74), (74, 231, 74), (0, 90, 0),
    (0, 136, 0), (0, 148, 0), (0, 222, 0), (0, 238, 0),
    (0, 251, 0), (74, 90, 148), (99, 115, 181), (123, 140, 214),
    (107, 123, 214), (119, 136, 255), (198, 198, 206), (148, 148, 156),
    (156, 148, 198), (49, 49, 57), (41, 24, 132), (24, 0, 132),
    (74, 66, 82), (82, 66, 123), (99, 90, 115), (206, 181, 247),
    (140, 123, 156), (119, 34, 204), (221, 170, 255), (240, 180, 42),
    (223, 0, 159), (227, 23, 179), (255, 251, 240), (160, 160, 164),
    (128, 128, 128), (255, 0, 0), (0, 255, 0), (255, 255, 0),
    (0, 0, 255), (255, 0, 255), (0, 255, 255), (255, 255, 255),
]


class WZXParser:
    """解析 WZX 索引文件, 获取每张图片在 WZL 中的偏移量"""

    def __init__(self, filepath: str):
        self.filepath = filepath
        self.offsets: list[int] = []
        self.image_count = 0

    def parse(self) -> list[int]:
        with open(self.filepath, 'rb') as f:
            # 跳过标题 (44 bytes)
            f.seek(44)
            # 读取图片数量 (4 bytes, uint32)
            self.image_count = struct.unpack('I', f.read(4))[0]
            # 读取偏移量数组
            for i in range(self.image_count):
                offset = struct.unpack('I', f.read(4))[0]
                self.offsets.append(offset)
        return self.offsets


class WZLParser:
    """解析 WZL 数据文件, 根据偏移量提取图片"""

    IMAGE_HEADER_SIZE = 16  # IMAGE 结构体大小

    def __init__(self, filepath: str):
        self.filepath = filepath
        self.file_data: bytes = b''
        self.file_size = 0

    def load(self):
        """加载 WZL 文件到内存"""
        with open(self.filepath, 'rb') as f:
            self.file_data = f.read()
        self.file_size = len(self.file_data)

    def read_image_header(self, offset: int) -> dict | None:
        """在指定偏移位置读取 IMAGE 结构"""
        if offset + self.IMAGE_HEADER_SIZE > self.file_size:
            return None

        header = self.file_data[offset:offset + self.IMAGE_HEADER_SIZE]
        if len(header) < self.IMAGE_HEADER_SIZE:
            return None

        pixel_format, compressed, reserve, compress_level, \
            width, height, x, y, size = struct.unpack('BBBBhhhhI', header)

        # 过滤无效图片
        if width <= 0 or height <= 0 or width > 2048 or height > 2048:
            return None
        if size <= 0 or size > 10 * 1024 * 1024:  # 最大 10MB
            return None

        return {
            'pixel_format': pixel_format,
            'compressed': compressed,
            'reserve': reserve,
            'compress_level': compress_level,
            'width': width,
            'height': height,
            'x': x,
            'y': y,
            'size': size,
            'data_offset': offset + self.IMAGE_HEADER_SIZE,
        }

    def extract_image(self, header: dict) -> Image.Image | None:
        """根据 IMAGE 头信息提取图片"""
        data_offset = header['data_offset']
        data_size = header['size']

        if data_offset + data_size > self.file_size:
            return None

        # 获取像素数据
        pixel_data = self.file_data[data_offset:data_offset + data_size]

        # 如果压缩了, 先解压
        if header['compressed']:
            try:
                pixel_data = zlib.decompress(pixel_data)
            except zlib.error:
                return None

        width = header['width']
        height = header['height']
        pixel_format = header['pixel_format']

        try:
            if pixel_format == 8:
                # 8-bit 调色板模式
                return self._decode_8bit(pixel_data, width, height)
            elif pixel_format == 16:
                # 16-bit RGB565 模式
                return self._decode_16bit(pixel_data, width, height)
            else:
                # 尝试作为 8-bit 处理
                return self._decode_8bit(pixel_data, width, height)
        except Exception:
            return None

    def _decode_8bit(self, data: bytes, width: int, height: int) -> Image.Image:
        """解码 8-bit 调色板模式图片"""
        expected_size = width * height
        if len(data) < expected_size:
            # 数据不足, 用 0 填充
            data = data + b'\x00' * (expected_size - len(data))

        # 创建调色板图像
        img = Image.new('P', (width, height))
        img.putdata(data[:expected_size])

        # 设置调色板
        palette = []
        for r, g, b in MIR_PALETTE:
            palette.extend([r, g, b])
        # 确保调色板有 256 色
        while len(palette) < 768:
            palette.extend([0, 0, 0])
        img.putpalette(palette[:768])

        # 转换为 RGBA, 将索引 0 (黑色) 设为透明
        img = img.convert('RGBA')
        pixels = img.load()
        for py in range(height):
            for px in range(width):
                r, g, b, a = pixels[px, py]
                # 传奇的透明色处理: 索引 0 通常为透明
                if r == 0 and g == 0 and b == 0:
                    pixels[px, py] = (0, 0, 0, 0)

        return img

    def _decode_16bit(self, data: bytes, width: int, height: int) -> Image.Image:
        """解码 16-bit RGB565 模式图片"""
        expected_size = width * height * 2
        if len(data) < expected_size:
            data = data + b'\x00' * (expected_size - len(data))

        img = Image.new('RGBA', (width, height))
        pixels = img.load()

        for py in range(height):
            for px in range(width):
                idx = (py * width + px) * 2
                if idx + 1 >= len(data):
                    break
                # RGB565: RRRRRGGGGGGBBBBB (little-endian)
                b16 = data[idx] | (data[idx + 1] << 8)
                r = ((b16 >> 11) & 0x1F) << 3
                g = ((b16 >> 5) & 0x3F) << 2
                b = (b16 & 0x1F) << 3

                # 黑色视为透明
                if r == 0 and g == 0 and b == 0:
                    pixels[px, py] = (0, 0, 0, 0)
                else:
                    pixels[px, py] = (r, g, b, 255)

        return img


class MirExtractor:
    """传奇素材提取器 - 整合 WZX 索引和 WZL 数据"""

    def __init__(self, wzl_path: str, wzx_path: str | None = None, output_dir: str = 'output'):
        self.wzl_path = wzl_path
        self.wzx_path = wzx_path
        self.output_dir = output_dir

        # 自动推断 WZX 路径
        if self.wzx_path is None:
            base = os.path.splitext(wzl_path)[0]
            self.wzx_path = base + '.wzx'
            if not os.path.exists(self.wzx_path):
                self.wzx_path = None

        self.wzl = WZLParser(wzl_path)
        self.wzx: WZXParser | None = None
        self.stats = {
            'total': 0,
            'extracted': 0,
            'empty': 0,
            'errors': 0,
        }

    def extract(self) -> dict:
        """执行提取"""
        # 加载 WZL
        print(f"加载 WZL: {self.wzl_path}")
        self.wzl.load()
        print(f"  文件大小: {self.wzl.file_size:,} bytes")

        # 读取 WZL 头部的图片数量
        if self.wzl.file_size >= 48:
            header_count = struct.unpack('I', self.wzl.file_data[44:48])[0]
            print(f"  WZL 头部图片数量: {header_count}")

        # 解析 WZX
        if self.wzx_path and os.path.exists(self.wzx_path):
            print(f"加载 WZX: {self.wzx_path}")
            self.wzx = WZXParser(self.wzx_path)
            offsets = self.wzx.parse()
            self.stats['total'] = len(offsets)
            print(f"  索引图片数量: {len(offsets)}")
        else:
            # 没有 WZX, 尝试顺序扫描 WZL
            print("未找到 WZX 文件, 使用顺序扫描模式")
            offsets = self._scan_wzl()
            self.stats['total'] = len(offsets)
            print(f"  扫描到图片: {len(offsets)}")

        # 创建输出目录
        os.makedirs(self.output_dir, exist_ok=True)

        # 提取图片
        print(f"\n开始提取...")
        metadata = []

        for i, offset in enumerate(offsets):
            if offset == 0:
                self.stats['empty'] += 1
                continue

            header = self.wzl.read_image_header(offset)
            if header is None:
                self.stats['empty'] += 1
                continue

            img = self.wzl.extract_image(header)
            if img is None:
                self.stats['errors'] += 1
                continue

            # 保存 PNG
            filename = f"{i:05d}.png"
            filepath = os.path.join(self.output_dir, filename)
            img.save(filepath, 'PNG')
            self.stats['extracted'] += 1

            # 记录元数据
            metadata.append({
                'index': i,
                'filename': filename,
                'width': header['width'],
                'height': header['height'],
                'offset_x': header['x'],
                'offset_y': header['y'],
                'pixel_format': header['pixel_format'],
                'compressed': bool(header['compressed']),
            })

            # 进度输出
            if (i + 1) % 100 == 0:
                print(f"  进度: {i + 1}/{len(offsets)} (已提取: {self.stats['extracted']})")

        # 保存元数据
        meta_path = os.path.join(self.output_dir, 'metadata.json')
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        # 生成精灵表 (Sprite Sheet) - 将所有帧合并为一张大图
        if metadata:
            self._generate_spritesheet(metadata)

        print(f"\n提取完成!")
        print(f"  总计: {self.stats['total']}")
        print(f"  成功: {self.stats['extracted']}")
        print(f"  空图: {self.stats['empty']}")
        print(f"  错误: {self.stats['errors']}")
        print(f"  输出: {self.output_dir}")

        return self.stats

    def _scan_wzl(self) -> list[int]:
        """顺序扫描 WZL 文件, 尝试找到所有有效图片"""
        offsets = []
        pos = 48  # 跳过文件头
        while pos < self.wzl.file_size - 16:
            header = self.wzl.read_image_header(pos)
            if header:
                offsets.append(pos)
                # 跳到下一张图片
                pos = header['data_offset'] + header['size']
            else:
                pos += 1
        return offsets

    def _generate_spritesheet(self, metadata: list[dict]):
        """生成精灵表 (所有帧合并为一张大图)"""
        if not metadata:
            return

        images = []
        for meta in metadata:
            filepath = os.path.join(self.output_dir, meta['filename'])
            if os.path.exists(filepath):
                img = Image.open(filepath)
                images.append((img, meta))

        if not images:
            return

        # 计算精灵表布局
        max_width = max(img.width for img, _ in images)
        max_height = max(img.height for img, _ in images)
        cols = min(16, len(images))  # 每行最多 16 帧
        rows = (len(images) + cols - 1) // cols

        sheet_width = cols * max_width
        sheet_height = rows * max_height
        sheet = Image.new('RGBA', (sheet_width, sheet_height), (0, 0, 0, 0))

        frame_info = []
        for idx, (img, meta) in enumerate(images):
            col = idx % cols
            row = idx // cols
            x = col * max_width
            y = row * max_height
            sheet.paste(img, (x, y))
            frame_info.append({
                'frame': idx,
                'original_index': meta['index'],
                'x': x,
                'y': y,
                'width': img.width,
                'height': img.height,
                'offset_x': meta['offset_x'],
                'offset_y': meta['offset_y'],
            })

        # 保存精灵表
        sheet_path = os.path.join(self.output_dir, 'spritesheet.png')
        sheet.save(sheet_path, 'PNG')

        # 保存精灵表元数据
        sheet_meta = {
            'image_width': sheet_width,
            'image_height': sheet_height,
            'frame_width': max_width,
            'frame_height': max_height,
            'columns': cols,
            'rows': rows,
            'total_frames': len(images),
            'frames': frame_info,
        }
        meta_path = os.path.join(self.output_dir, 'spritesheet.json')
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(sheet_meta, f, ensure_ascii=False, indent=2)

        print(f"  精灵表: {sheet_path} ({sheet_width}x{sheet_height})")


# ============================================================
# 命令行入口
# ============================================================
def main():
    if len(sys.argv) < 2:
        print("传奇 WZL/WZX 素材提取工具")
        print("=" * 40)
        print(f"用法: python {sys.argv[0]} <wzl文件> [wzx文件] [输出目录]")
        print()
        print("示例:")
        print(f"  python {sys.argv[0]} Mon1.wzl")
        print(f"  python {sys.argv[0]} Mon1.wzl Mon1.wzx output/monsters")
        print(f"  python {sys.argv[0]} Hum.wzl Hum.wzx output/characters")
        sys.exit(0)

    wzl_path = sys.argv[1]
    wzx_path = sys.argv[2] if len(sys.argv) > 2 else None
    output_dir = sys.argv[3] if len(sys.argv) > 3 else 'output'

    if not os.path.exists(wzl_path):
        print(f"错误: WZL 文件不存在: {wzl_path}")
        sys.exit(1)

    extractor = MirExtractor(wzl_path, wzx_path, output_dir)
    extractor.extract()


if __name__ == '__main__':
    main()
