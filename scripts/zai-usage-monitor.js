#!/usr/bin/env node
/**
 * Z.AI GLM使用量モニター
 * 定期的にZ.AIダッシュボードにログインし、使用量を取得してDiscordに通知
 */

require('dotenv').config({ path: '/home/node/.openclaw/.env' });
const puppeteer = require('puppeteer');
const fs = require('fs');

const CONFIG = {
  zaiLoginUrl: 'https://z.ai/login',
  zaiDashboardUrl: 'https://z.ai/manage-apikey/subscription',
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
  threshold30: 0.3,
  threshold10: 0.1,
};

async function loginToZai(page) {
  console.log('Z.AIにログイン中...');
  
  await page.goto(CONFIG.zaiLoginUrl, { waitUntil: 'networkidle2' });
  
  // メールアドレス入力
  await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email"]', { timeout: 10000 });
  await page.type('input[type="email"], input[name="email"], input[placeholder*="email"]', process.env.ZAI_EMAIL);
  
  // パスワード入力
  await page.type('input[type="password"], input[name="password"]', process.env.ZAI_PASSWORD);
  
  // ログインボタンクリック
  await page.click('button[type="submit"], button:contains("ログイン"), button:contains("Login")');
  
  // ログイン完了待機
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
  
  console.log('ログイン完了');
}

async function getUsage(page) {
  console.log('使用量取得中...');
  
  await page.goto(CONFIG.zaiDashboardUrl, { waitUntil: 'networkidle2' });
  
  // ページの内容を取得
  const content = await page.content();
  
  // スクリーンショット保存（デバッグ用）
  const screenshotPath = '/home/node/.openclaw/workspace/memory/zai-usage-screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  
  // 使用量を抽出（セレクタは実際のページ構造に合わせて調整が必要）
  const usageData = await page.evaluate(() => {
    // ここは実際のZ.AIダッシュボードのHTML構造に合わせて調整
    const result = {
      timestamp: new Date().toISOString(),
      rawText: document.body.innerText,
      // プレースホルダー - 実際のセレクタに置き換える必要がある
      usagePercent: null,
      remaining: null,
      total: null,
    };
    
    // パーセンテージを探す（例: "75%" など）
    const percentMatch = document.body.innerText.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) {
      result.usagePercent = parseFloat(percentMatch[1]);
    }
    
    return result;
  });
  
  console.log('使用量取得完了:', usageData);
  return usageData;
}

async function sendToDiscord(usageData) {
  if (!CONFIG.discordWebhookUrl) {
    console.log('Discord Webhook URL未設定 - スキップ');
    return;
  }
  
  const embed = {
    title: '📊 GLM使用量レポート',
    description: `**取得時刻**: ${new Date(usageData.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
    color: usageData.usagePercent && usageData.usagePercent > 70 ? 0xFF0000 : 0x00FF00,
    fields: [
      {
        name: '使用率',
        value: usageData.usagePercent ? `${usageData.usagePercent}%` : '取得失敗',
        inline: true,
      },
    ],
    footer: { text: 'Z.AI GLM Usage Monitor' },
  };
  
  await fetch(CONFIG.discordWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  
  console.log('Discord通知送信完了');
}

async function saveUsageData(usageData) {
  const logPath = '/home/node/.openclaw/workspace/memory/zai-usage-log.json';
  
  let logs = [];
  if (fs.existsSync(logPath)) {
    logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  }
  
  logs.push(usageData);
  
  // 直近30日分のみ保持
  if (logs.length > 288) { // 6時間ごとで30日 = 120回程度
    logs = logs.slice(-288);
  }
  
  fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  console.log('使用量ログ保存完了');
}

async function main() {
  console.log('=== GLM使用量モニター開始 ===');
  console.log('時刻:', new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // User-Agent設定（ボット検知回避）
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await loginToZai(page);
    const usageData = await getUsage(page);
    
    await saveUsageData(usageData);
    await sendToDiscord(usageData);
    
    // 結果をJSON出力（Cron用）
    console.log(JSON.stringify(usageData));
    
  } catch (error) {
    console.error('エラー発生:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
