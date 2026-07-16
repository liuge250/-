#!/usr/bin/env python3
"""
传奇游戏数据提取工具
从 OpenMir2 SQL 文件中提取游戏数据并转换为 JSON
"""

import json
import re
import os

SQL_DIR = "/workspace/projects/OpenMir2/sql"
OUTPUT_DIR = "/workspace/projects/mir-tools/game-data"

os.makedirs(OUTPUT_DIR, exist_ok=True)


def parse_sql_values(sql_content, table_name):
    """解析SQL INSERT语句，返回列名和数据列表"""
    # 提取CREATE TABLE中的列名
    create_pattern = rf"CREATE TABLE `{table_name}`\s*\((.*?)\)\s*ENGINE"
    create_match = re.search(create_pattern, sql_content, re.DOTALL)
    if not create_match:
        print(f"  警告: 找不到 {table_name} 表定义")
        return [], []

    create_body = create_match.group(1)
    columns = []
    for line in create_body.split('\n'):
        line = line.strip()
        if line.startswith('`'):
            col_match = re.match(r'`(\w+)`', line)
            if col_match:
                columns.append(col_match.group(1))

    # 提取INSERT语句中的值
    insert_pattern = rf"INSERT INTO `{table_name}` VALUES \((.+?)\);"
    records = []
    for match in re.finditer(insert_pattern, sql_content, re.DOTALL):
        values_str = match.group(1)
        # 解析值（处理字符串和NULL）
        values = []
        current = ""
        in_string = False
        for char in values_str:
            if char == "'" and not in_string:
                in_string = True
            elif char == "'" and in_string:
                in_string = False
            elif char == ',' and not in_string:
                val = current.strip()
                if val == 'NULL':
                    values.append(None)
                elif val.startswith("'") and val.endswith("'"):
                    values.append(val[1:-1])
                else:
                    try:
                        values.append(int(val))
                    except ValueError:
                        try:
                            values.append(float(val))
                        except ValueError:
                            values.append(val)
                current = ""
                continue
            current += char
        # 处理最后一个值
        val = current.strip()
        if val == 'NULL':
            values.append(None)
        elif val.startswith("'") and val.endswith("'"):
            values.append(val[1:-1])
        else:
            try:
                values.append(int(val))
            except ValueError:
                try:
                    values.append(float(val))
                except ValueError:
                    values.append(val)

        # 将值映射到列名（跳过Id列）
        if len(values) >= len(columns):
            record = {}
            for i, col in enumerate(columns):
                record[col] = values[i] if i < len(values) else None
            records.append(record)

    return columns, records


def extract_stditems():
    """提取物品数据"""
    print("提取物品数据...")
    with open(f"{SQL_DIR}/mir2_data.sql", 'r', encoding='utf-8') as f:
        content = f.read()

    columns, records = parse_sql_values(content, 'stditems')
    print(f"  提取了 {len(records)} 条物品记录")

    # 按 StdMode 分类
    categories = {
        0: "药品杂货",
        1: "头盔",
        4: "衣服",
        5: "武器",
        6: "矿石",
        10: "项链",
        11: "项链",
        15: "戒指",
        19: "鞋子",
        20: "卷轴",
        21: "卷轴",
        22: "卷轴",
        23: "卷轴",
        24: "卷轴",
        25: "卷轴",
        26: "卷轴",
        30: "肉",
        31: "矿石",
        40: "书籍",
        45: "特殊装备",
        46: "特殊装备",
    }

    for item in records:
        std_mode = item.get('StdMode', 0)
        item['Category'] = categories.get(std_mode, "其他")

    return records


def extract_monsters():
    """提取怪物数据"""
    print("提取怪物数据...")
    with open(f"{SQL_DIR}/mir2_data.sql", 'r', encoding='utf-8') as f:
        content = f.read()

    columns, records = parse_sql_values(content, 'monsters')
    print(f"  提取了 {len(records)} 条怪物记录")
    return records


def extract_magics():
    """提取技能数据"""
    print("提取技能数据...")
    with open(f"{SQL_DIR}/mir2_data.sql", 'r', encoding='utf-8') as f:
        content = f.read()

    columns, records = parse_sql_values(content, 'magics')
    print(f"  提取了 {len(records)} 条技能记录")

    # 按职业分类
    job_names = {0: "战士", 1: "法师", 2: "道士"}
    for magic in records:
        job = magic.get('Job', 0)
        magic['JobName'] = job_names.get(job, "未知")

    return records


def main():
    print("=" * 50)
    print("传奇游戏数据提取工具 (OpenMir2)")
    print("=" * 50)

    # 提取数据
    stditems = extract_stditems()
    monsters = extract_monsters()
    magics = extract_magics()

    # 保存数据
    print("\n保存数据...")

    with open(f"{OUTPUT_DIR}/stditems.json", 'w', encoding='utf-8') as f:
        json.dump(stditems, f, ensure_ascii=False, indent=2)
    print(f"  stditems.json: {len(stditems)} 条")

    with open(f"{OUTPUT_DIR}/monsters.json", 'w', encoding='utf-8') as f:
        json.dump(monsters, f, ensure_ascii=False, indent=2)
    print(f"  monsters.json: {len(monsters)} 条")

    with open(f"{OUTPUT_DIR}/magics.json", 'w', encoding='utf-8') as f:
        json.dump(magics, f, ensure_ascii=False, indent=2)
    print(f"  magics.json: {len(magics)} 条")

    # 打印示例
    print("\n=== 物品示例 ===")
    for item in stditems[:8]:
        name = item.get('Name', 'N/A')
        std_mode = item.get('StdMode', 'N/A')
        category = item.get('Category', 'N/A')
        dc = item.get('Dc', 0) or 0
        dc_max = item.get('DcMax', 0) or 0
        ac = item.get('Ac', 0) or 0
        ac_max = item.get('AcMax', 0) or 0
        price = item.get('Price', 0) or 0
        print(f"  [{category}] {name} - StdMode:{std_mode} DC:{dc}-{dc_max} AC:{ac}-{ac_max} Price:{price}")

    print("\n=== 怪物示例 ===")
    for mon in monsters[:8]:
        name = mon.get('Name', 'N/A')
        lvl = mon.get('Lvl', 'N/A')
        hp = mon.get('MaxHP', 'N/A')
        exp = mon.get('Exp', 'N/A')
        print(f"  {name} - Lvl:{lvl} HP:{hp} Exp:{exp}")

    print("\n=== 技能示例 ===")
    for magic in magics[:8]:
        name = magic.get('Name', 'N/A')
        job = magic.get('JobName', 'N/A')
        need_lvl = magic.get('NeedLevel', 'N/A')
        print(f"  [{job}] {name} - NeedLvl:{need_lvl}")

    print("\n" + "=" * 50)
    print("提取完成!")
    print(f"输出目录: {OUTPUT_DIR}")
    print("=" * 50)


if __name__ == '__main__':
    main()
