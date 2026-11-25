#!/usr/bin/env node
// Netlify 构建脚本：静态产物 = src 副本 + app.js 的图片域 AH 指向官方 pwimg（本地部署不存在图库产物，直接热链）。
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

rmSync('publish', { recursive: true, force: true });
mkdirSync('publish', { recursive: true });
cpSync('src', 'publish', { recursive: true });
const p = 'publish/app.js';
// 注意替换串必须带结尾分号——上次漏了导致线上 app.js 语法错误、整站白屏（2026-11-25 教训）
const replaced = readFileSync(p, 'utf8').replace("const AH='';", "const AH='https://pwimg.0vo.pro/';");
if (!replaced.includes("const AH='https://pwimg.0vo.pro/';")) throw new Error('app.js 的 AH 常量未找到，检查 src/app.js 是否被上游改动');
writeFileSync(p, replaced);
execSync('node --check publish/app.js', { stdio: 'inherit' }); // 构建产物必须过语法检查
console.log('publish/ 就绪：静态文件 + AH 热链补丁（语法校验通过）');
