const fs = require('fs');
const puppeteer = require('puppeteer');
const axios = require('axios');

function formatToISO(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d{3}Z/, '');
}

async function delayTime(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  // 读取 accounts.json 中的 JSON 字符串
  const configJson = fs.readFileSync('accounts.json', 'utf-8');
  const config = JSON.parse(configJson);
  const accounts = config;

  const bncrConfigJson = fs.readFileSync('bncr.json', 'utf-8');
  const bncrConfig = JSON.parse(bncrConfigJson);
  const { BncrHost, BncrToken } = bncrConfig;

  let logs = [];

  for (const account of accounts) {
    const { username, password, panelnum } = account;

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    let url = `https://panel${panelnum}.serv00.com/login/?next=/`;

    try {
      // 修改网址为新的登录页面
      await page.goto(url);

      // 清空用户名输入框的原有值
      const usernameInput = await page.$('#id_username');
      if (usernameInput) {
        await usernameInput.click({ clickCount: 3 }); // 选中输入框的内容
        await usernameInput.press('Backspace'); // 删除原来的值
      }

      // 输入实际的账号和密码
      await page.type('#id_username', username);
      await page.type('#id_password', password);

      // 提交登录表单
      const loginButton = await page.$('#submit');
      if (loginButton) {
        await loginButton.click();
      } else {
        throw new Error('无法找到登录按钮');
      }

      // 等待登录成功（如果有跳转页面的话）
      await page.waitForNavigation();

      // 判断是否登录成功
      const isLoggedIn = await page.evaluate(() => {
        const logoutButton = document.querySelector('a[href="/logout/"]');
        return logoutButton !== null;
      });

      const nowUtc = formatToISO(new Date()); // UTC时间
      const nowBeijing = formatToISO(new Date(new Date().getTime() + 8 * 60 * 60 * 1000)); // 北京时间东8区，用算术来搞

      if (isLoggedIn) {
        const successLog = `账号 ${username} 于北京时间 ${nowBeijing}（UTC时间 ${nowUtc}）登录成功！`;
        console.log(successLog);
        logs.push(successLog);
      } else {
        const failureLog = `账号 ${username} 登录失败，请检查账号和密码是否正确。`;
        console.error(failureLog);
        logs.push(failureLog);
      }
    } catch (error) {
      const errorLog = `账号 ${username} 登录时出现错误: ${error}`;
      console.error(errorLog);
      logs.push(errorLog);
    } finally {
      // 关闭页面和浏览器
      await page.close();
      await browser.close();

      // 用户之间添加随机延时
      const delay = Math.floor(Math.random() * 8000) + 1000; // 随机延时1秒到8秒之间
      await delayTime(delay);
    }
  }

  console.log('所有账号登录完成！');

  // 发送日志信息到服务器
  const logData = {
    title: 'serv00登录日志',
    message: logs.join('\n'),
    token: BncrToken
  };

  const options = {
    url: `${BncrHost}/api/notify`,
    method: 'POST',
    data: `title=${encodeURIComponent(logData.title)}&desc=${encodeURIComponent(logData.message)}&token=${BncrToken}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  try {
    const response = await axios(options);
    if (response.data.success) {
      console.log('Bncr发送通知消息成功🎉');
    } else {
      console.log(`Bncr发送通知调用API失败：${response.data.msg}`);
    }
  } catch (error) {
    console.error('发送日志信息时出现错误:', error);
  }
})();

// 自定义延时函数
function delayTime(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
