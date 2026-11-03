---
title: 实战Live勒索病毒溯源排查
published: 2026-04-13T00:00:00.000Z
updated: 2026-04-14T00:00:00.000Z
tags:
  - 玄机
  - 应急响应
category: 技术
draft: false
---
![image.png](https://raw.githubusercontent.com/wenject/tuchuang/main/20260412141158325.png)
先使用xterminal连接机器
![image.png](https://raw.githubusercontent.com/wenject/tuchuang/main/20260412141241470.png)
先排查病毒家族的名字
先看进程与网络连接方面有啥问题

```
netstat -ano | findstr "ESTABLISHED"
```

![image-20260412141908456](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412141908456.png)

3788感觉有点问题，维护了大量443端口外连，符合**木马回传数据**或**大规模扫描/传播**的特征。

![image-20260412143828819](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412143828819.png)

查了md5之后感觉没啥东西
然后看了下wp，要从桌面入手

![image-20260412145846404](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412145846404.png)

后缀带有live，把它丢进

[应急响应.com]: 	"12"

![image-20260412150036412](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412150036412.png)

直接显示了病毒家族的名字
live

![image-20260412150152261](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412150152261.png)

![image-20260412150634479](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412150634479.png)

桌面就有这玩意，直接提交flag

![image-20260412151151913](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412151151913.png)

这个就是恢复文件，直接去应急响应.com下载对应恢复工具

![image-20260412151044371](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412151044371.png)

这工具很逆天，必须要加上-path=才能解密文件

![image-20260412151639553](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412151639553.png)

![image-20260412151658124](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412151658124.png)

![image-20260412151938922](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412151938922.png)

Windows Server 2016版本默认安装了Windows defender杀毒软件

![image-20260412152347093](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412152347093.png)

直接查看历史记录就行
**flag{2025.8.25_10:43}**

![image-20260412152412970](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412152412970.png)

环境自带了查日志的工具

![image-20260412152615863](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412152615863.png)

查事件id

![image-20260412152751158](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412152751158.png)

登录成功ID为4624，登录失败为4625

**1166**（停止）、**1167**（启动）或者 **5001**（禁用）

查4625的时候没有查到合适的

所有系统没有开启审核策略记录日志

**flag{2025.8.25_10:45}**

![image-20260412153951708](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412153951708.png)

之前defend里面查到隔离的文件，直接everything搜索

![image-20260412154537030](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412154537030.png)

![image-20260412155448817](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412155448817.png)

直接丢微步，直接分析出外联地址

![image-20260412155400142](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412155400142.png)

![image-20260412155545841](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412155545841.png)

![image-20260412155807813](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412155807813.png)

先查看live具体被加密时间，然后寻找加密器，加密器大部分都是.exe



![image-20260412160147141](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412160147141.png)

时间相近有点可疑
![image-20260412160318479](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412160318479.png)

丢进沙箱，确实为木马
提交这个flag

![image-20260412160502481](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412160502481.png)

> 2025.8.25 10:43攻击者尝试上传C2但被Windows defender清除

> 2025.8.25 10:45攻击者尝试关闭Windows defender成功

> 2025.8.25 10:48攻击者再次上传C2成功

> 2025.8.25 11:00攻击者上传加密器成功

> 2025.8.25 11:15攻击者触发加密器成功开始加密

![image-20260412160959600](https://raw.githubusercontent.com/wenject/tuchuang/main/image-20260412160959600.png)

**flag{E:\ruoyi\ruoyi-admin.jar}**
