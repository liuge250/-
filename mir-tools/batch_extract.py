#!/usr/bin/env python3
"""
传奇素材批量提取工具
====================
批量提取传奇客户端 Data 目录下的所有 WZL/WZX 素材

使用方法:
    python batch_extract.py <传奇客户端Data目录> [输出目录]

示例:
    python batch_extract.py /path/to/Mir2/Data ./output
"""

import os
import sys
import json
from pathlib import Path

# 导入提取器
from wzl_extractor import MirExtractor


# 传奇素材文件分类映射
FILE_CATEGORIES = {
    # 怪物
    'monsters': ['Mon', 'mon'],
    # 角色人物
    'characters': ['Hum', 'hum', 'Hair', 'ChrSel'],
    # 武器
    'weapons': ['Weapon', 'weapon', 'WeaponEffect'],
    # 地图地砖
    'tiles': ['Tiles', 'tiles', 'Objects', 'SmTiles', 'Effect'],
    # 物品
    'items': ['Items', 'items', 'DnItems', 'StateItem'],
    # 魔法特效
    'effects': ['Magic', 'magic', 'MagIcon'],
    # NPC
    'npc': ['NPC', 'npc'],
    # UI界面
    'ui': ['Prguse', 'prguse', 'xGamePlan'],
    # 其他
    'other': [],
}


def get_category(filename: str) -> str:
    """根据文件名判断分类"""
    base = os.path.splitext(filename)[0]
    for category, prefixes in FILE_CATEGORIES.items():
        for prefix in prefixes:
            if base.startswith(prefix) or base.lower().startswith(prefix.lower()):
                return category
    return 'other'


def batch_extract(data_dir: str, output_dir: str):
    """批量提取所有 WZL 文件"""
    data_path = Path(data_dir)
    output_path = Path(output_dir)

    if not data_path.exists():
        print(f"错误: 目录不存在: {data_dir}")
        sys.exit(1)

    # 查找所有 WZL 文件
    wzl_files = list(data_path.glob('*.wzl')) + list(data_path.glob('*.WZL'))
    if not wzl_files:
        print(f"未找到 WZL 文件: {data_dir}")
        sys.exit(1)

    print(f"找到 {len(wzl_files)} 个 WZL 文件")
    print(f"输出目录: {output_dir}")
    print()

    # 按分类提取
    results = {}
    total_stats = {'total': 0, 'extracted': 0, 'empty': 0, 'errors': 0}

    for wzl_file in sorted(wzl_files):
        filename = wzl_file.name
        category = get_category(filename)
        category_dir = output_path / category / wzl_file.stem

        print(f"\n{'='*50}")
        print(f"文件: {filename} -> {category}/{wzl_file.stem}")
        print(f"{'='*50}")

        # 查找对应的 WZX 文件
        wzx_file = wzl_file.with_suffix('.wzx')
        if not wzx_file.exists():
            wzx_file = wzl_file.with_suffix('.WZX')
        wzx_path = str(wzx_file) if wzx_file.exists() else None

        try:
            extractor = MirExtractor(
                str(wzl_file),
                wzx_path,
                str(category_dir)
            )
            stats = extractor.extract()

            results[filename] = {
                'category': category,
                'output': str(category_dir),
                'stats': stats,
            }

            for key in total_stats:
                total_stats[key] += stats.get(key, 0)

        except Exception as e:
            print(f"  错误: {e}")
            results[filename] = {
                'category': category,
                'error': str(e),
            }

    # 保存汇总报告
    report = {
        'source': str(data_dir),
        'output': str(output_dir),
        'total_files': len(wzl_files),
        'total_stats': total_stats,
        'files': results,
    }
    report_path = output_path / 'extraction_report.json'
    os.makedirs(output_path, exist_ok=True)
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # 打印汇总
    print(f"\n{'='*50}")
    print(f"批量提取完成!")
    print(f"{'='*50}")
    print(f"  文件数: {len(wzl_files)}")
    print(f"  总图片: {total_stats['extracted']}")
    print(f"  空图: {total_stats['empty']}")
    print(f"  错误: {total_stats['errors']}")
    print(f"  报告: {report_path}")

    # 按分类统计
    print(f"\n分类统计:")
    for category in FILE_CATEGORIES:
        cat_files = [r for r in results.values() if r.get('category') == category]
        cat_extracted = sum(r.get('stats', {}).get('extracted', 0) for r in cat_files)
        if cat_files:
            print(f"  {category}: {len(cat_files)} 文件, {cat_extracted} 张图片")


def main():
    if len(sys.argv) < 2:
        print("传奇素材批量提取工具")
        print("=" * 40)
        print(f"用法: python {sys.argv[0]} <Data目录> [输出目录]")
        print()
        print("示例:")
        print(f"  python {sys.argv[0]} /path/to/Mir2/Data ./output")
        print()
        print("素材分类:")
        for category, prefixes in FILE_CATEGORIES.items():
            print(f"  {category}: {', '.join(prefixes[:3])}...")
        sys.exit(0)

    data_dir = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else './output'

    batch_extract(data_dir, output_dir)


if __name__ == '__main__':
    main()
