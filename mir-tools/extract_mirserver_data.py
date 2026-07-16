#!/usr/bin/env python3
"""
从 MirServer 提取完整游戏数据并转为 JSON
"""
import os
import json
import struct
import re

MIRSERVER = "/workspace/projects/MirServer/Mir200/Envir"
OUTPUT = "/workspace/projects/mir-tools/game-data"

def read_gbk_file(filepath):
    """读取GBK编码文件"""
    try:
        with open(filepath, 'r', encoding='gbk', errors='ignore') as f:
            return f.read()
    except:
        return ""

def parse_map_info():
    """解析 MapInfo.txt - 地图配置"""
    content = read_gbk_file(os.path.join(MIRSERVER, "MapInfo.txt"))
    maps = []
    connections = []
    
    for line in content.split('\n'):
        line = line.strip()
        if not line or line.startswith(';'):
            continue
        
        # 地图定义: [mapfile mapname] flags
        m = re.match(r'\[(\S+)\s+([^\]]+?)\](.*)', line)
        if m:
            map_file = m.group(1)
            map_name = m.group(2).strip()
            flags_str = m.group(3).strip()
            
            # 解析标志
            flags = []
            if 'SAFE' in flags_str:
                flags.append('safe')
            if 'DAY' in flags_str:
                flags.append('day')
            if 'FIGHT' in flags_str or 'Fight' in flags_str:
                flags.append('pvp')
            if 'NORECALL' in flags_str:
                flags.append('no_recall')
            if 'NORANDOMMOVE' in flags_str:
                flags.append('no_random_move')
            
            # 处理 | 别名
            if '|' in map_file:
                parts = map_file.split('|')
                map_file = parts[0]
            
            maps.append({
                'file': map_file,
                'name': map_name,
                'flags': flags
            })
            continue
        
        # 地图连接: mapfile x y -> mapfile2 x2 y2
        m = re.match(r'(\S+)\s+(\d+)\s*,\s*(\d+)\s*->\s*(\S+)\s+(\d+)\s*,\s*(\d+)', line)
        if m:
            connections.append({
                'from_map': m.group(1),
                'from_x': int(m.group(2)),
                'from_y': int(m.group(3)),
                'to_map': m.group(4),
                'to_x': int(m.group(5)),
                'to_y': int(m.group(6))
            })
    
    return {'maps': maps, 'connections': connections}

def parse_mon_gen():
    """解析 MonGen.txt - 怪物刷新配置"""
    content = read_gbk_file(os.path.join(MIRSERVER, "MonGen.txt"))
    spawns = []
    
    for line in content.split('\n'):
        line = line.strip()
        if not line or line.startswith(';'):
            continue
        
        parts = line.split()
        if len(parts) >= 6:
            try:
                spawns.append({
                    'map': parts[0],
                    'x': int(parts[1]),
                    'y': int(parts[2]),
                    'monster': parts[3],
                    'range': int(parts[4]) if len(parts) > 4 else 0,
                    'count': int(parts[5]) if len(parts) > 5 else 1,
                    'respawn_time': int(parts[6]) if len(parts) > 6 else 60
                })
            except (ValueError, IndexError):
                continue
    
    return spawns

def parse_mon_items():
    """解析 MonItems/ - 怪物爆率"""
    items_dir = os.path.join(MIRSERVER, "MonItems")
    drops = {}
    
    if not os.path.isdir(items_dir):
        return drops
    
    for filename in os.listdir(items_dir):
        if not filename.endswith('.txt'):
            continue
        
        monster_name = filename[:-4]
        filepath = os.path.join(items_dir, filename)
        content = read_gbk_file(filepath)
        
        items = []
        for line in content.split('\n'):
            line = line.strip()
            if not line:
                continue
            
            # 格式: 概率/数量 物品名 [金币数量]
            m = re.match(r'(\d+)/(\d+)\s+(.+)', line)
            if m:
                chance = int(m.group(1))
                count = int(m.group(2))
                item_name = m.group(3).strip()
                
                # 检查是否有金币数量
                gold_match = re.match(r'金币\s+(\d+)', item_name)
                if gold_match:
                    items.append({
                        'item': '金币',
                        'amount': int(gold_match.group(1)),
                        'chance': f"{chance}/{count}"
                    })
                else:
                    items.append({
                        'item': item_name,
                        'chance': f"{chance}/{count}"
                    })
        
        if items:
            drops[monster_name] = items
    
    return drops

def parse_merchant():
    """解析 MerChant.txt - NPC商人配置"""
    content = read_gbk_file(os.path.join(MIRSERVER, "MerChant.txt"))
    npcs = []
    
    for line in content.split('\n'):
        line = line.strip()
        if not line or line.startswith(';'):
            continue
        
        parts = line.split()
        if len(parts) >= 6:
            try:
                npc = {
                    'name': parts[0],
                    'map': parts[1],
                    'x': int(parts[2]),
                    'y': int(parts[3]),
                    'title': parts[4] if len(parts) > 4 else '',
                    'type': int(parts[5]) if len(parts) > 5 else 0
                }
                npcs.append(npc)
            except (ValueError, IndexError):
                continue
    
    return npcs

def parse_map_files():
    """解析所有地图文件的基本信息"""
    map_dir = "/workspace/projects/MirServer/Mir200/Map"
    map_data = []
    
    if not os.path.isdir(map_dir):
        return map_data
    
    for filename in sorted(os.listdir(map_dir)):
        if not filename.endswith('.map'):
            continue
        
        filepath = os.path.join(map_dir, filename)
        file_size = os.path.getsize(filepath)
        
        try:
            with open(filepath, 'rb') as f:
                header = f.read(52)
                if len(header) < 4:
                    continue
                
                width = struct.unpack_from('<H', header, 0)[0]
                height = struct.unpack_from('<H', header, 2)[0]
                
                # 读取标题
                title_bytes = header[4:21]
                title = title_bytes.split(b'\x00')[0].decode('ascii', errors='ignore')
                
                if width > 0 and height > 0 and width < 5000 and height < 5000:
                    map_data.append({
                        'file': filename[:-4],
                        'width': width,
                        'height': height,
                        'title': title,
                        'size_kb': file_size // 1024
                    })
        except:
            continue
    
    return map_data

def parse_exp_list():
    """解析经验表"""
    content = read_gbk_file(os.path.join(MIRSERVER, "../Configs/ExpList.ini"))
    if not content:
        content = read_gbk_file("/workspace/projects/mir2-database/Jev/Configs/ExpList.ini")
    
    exp_list = {}
    for line in content.split('\n'):
        line = line.strip()
        m = re.match(r'Level(\d+)\s*=\s*(\d+)', line)
        if m:
            exp_list[int(m.group(1))] = int(m.group(2))
    
    return exp_list

def parse_base_stats():
    """解析职业基础属性"""
    configs_dir = "/workspace/projects/mir2-database/Jev/Configs"
    stats = {}
    
    for class_name in ['Warrior', 'Wizard', 'Taoist']:
        filepath = os.path.join(configs_dir, f"BaseStats{class_name}.ini")
        if not os.path.exists(filepath):
            continue
        
        with open(filepath, 'r', errors='ignore') as f:
            content = f.read()
        
        class_stats = {}
        for line in content.split('\n'):
            line = line.strip()
            if '=' in line:
                parts = line.split('=', 1)
                key = parts[0].strip()
                try:
                    val = int(parts[1].strip())
                except:
                    try:
                        val = float(parts[1].strip())
                    except:
                        val = parts[1].strip()
                class_stats[key] = val
        
        stats[class_name.lower()] = class_stats
    
    return stats

def main():
    os.makedirs(OUTPUT, exist_ok=True)
    
    print("=" * 50)
    print("  MirServer 数据提取")
    print("=" * 50)
    
    # 1. 地图配置
    print("\n[1/7] 解析地图配置...")
    map_info = parse_map_info()
    with open(os.path.join(OUTPUT, 'map_info.json'), 'w', encoding='utf-8') as f:
        json.dump(map_info, f, ensure_ascii=False, indent=2)
    print(f"  地图: {len(map_info['maps'])} 个")
    print(f"  连接点: {len(map_info['connections'])} 个")
    
    # 2. 怪物刷新
    print("\n[2/7] 解析怪物刷新...")
    mon_gen = parse_mon_gen()
    with open(os.path.join(OUTPUT, 'monster_spawns.json'), 'w', encoding='utf-8') as f:
        json.dump(mon_gen, f, ensure_ascii=False, indent=2)
    print(f"  刷新点: {len(mon_gen)} 个")
    
    # 3. 怪物爆率
    print("\n[3/7] 解析怪物爆率...")
    mon_items = parse_mon_items()
    with open(os.path.join(OUTPUT, 'monster_drops.json'), 'w', encoding='utf-8') as f:
        json.dump(mon_items, f, ensure_ascii=False, indent=2)
    print(f"  怪物种类: {len(mon_items)} 种")
    
    # 4. NPC商人
    print("\n[4/7] 解析NPC商人...")
    merchants = parse_merchant()
    with open(os.path.join(OUTPUT, 'merchants.json'), 'w', encoding='utf-8') as f:
        json.dump(merchants, f, ensure_ascii=False, indent=2)
    print(f"  NPC: {len(merchants)} 个")
    
    # 5. 地图文件信息
    print("\n[5/7] 解析地图文件...")
    map_files = parse_map_files()
    with open(os.path.join(OUTPUT, 'map_files.json'), 'w', encoding='utf-8') as f:
        json.dump(map_files, f, ensure_ascii=False, indent=2)
    print(f"  地图文件: {len(map_files)} 个")
    
    # 6. 经验表
    print("\n[6/7] 解析经验表...")
    exp_list = parse_exp_list()
    with open(os.path.join(OUTPUT, 'exp_list.json'), 'w', encoding='utf-8') as f:
        json.dump(exp_list, f, ensure_ascii=False, indent=2)
    print(f"  等级数: {len(exp_list)}")
    
    # 7. 职业属性
    print("\n[7/7] 解析职业属性...")
    base_stats = parse_base_stats()
    with open(os.path.join(OUTPUT, 'base_stats.json'), 'w', encoding='utf-8') as f:
        json.dump(base_stats, f, ensure_ascii=False, indent=2)
    print(f"  职业: {list(base_stats.keys())}")
    
    print("\n" + "=" * 50)
    print("  提取完成!")
    print(f"  输出目录: {OUTPUT}")
    print("=" * 50)

if __name__ == '__main__':
    main()
