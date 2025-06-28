const { chromium } = require('playwright');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/124.0.2478.80',
];

function randomDelay(min = 2000, max = 6000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseNaukariTime(str) {
  if (!str) return null;
  const now = new Date();

  // "3 hrs ago", "15 min ago"
  const agoMatch = str.match(/(\d+)\s*(hr|hrs|hour|hours|min|minute|minutes)\s*ago/i);
  if (agoMatch) {
    const value = parseInt(agoMatch[1], 10);
    if (/min|minute/i.test(agoMatch[2])) {
      return new Date(now.getTime() - value * 60 * 1000);
    } else {
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    }
  }

  // "24 Jun" or "5 Jul"
  const dateMatch = str.match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const monthStr = dateMatch[2];
    const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(monthStr);
    if (month !== -1) {
      const year = now.getMonth() < month ? now.getFullYear() - 1 : now.getFullYear(); // handle year wrap
      return new Date(year, month, day);
    }
  }

  return null;
}

function isWithinTimeframe(postingTimeStr, time) {
  if (!time) return true;
  const postDate = parseNaukariTime(postingTimeStr);
  if (!postDate) return false;
  const now = new Date();
  if (time === "24h") {
    return (now - postDate) <= 24 * 60 * 60 * 1000;
  }
  if (time === "7d") {
    return (now - postDate) <= 7 * 24 * 60 * 60 * 1000;
  }
  return true;
}

module.exports = async (time) => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-http2']
  });
  let allJobs = [];

  for (let pageNo = 1; pageNo <= 1; pageNo++) {
    let url = pageNo === 1 ?
      `https://www.naukrigulf.com/jobs-in-saudi-arabia`
      : `https://www.naukrigulf.com/jobs-in-saudi-arabia-${pageNo}`;

    // Set a random user agent for each request
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const context = await browser.newContext({
      userAgent,
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });
    const page = await context.newPage();

    // Set some common headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    await page.addInitScript(() => {
      // Remove navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // Fake plugins and languages
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(randomDelay(2000, 5000));
      await page.waitForSelector('.ng-box.srp-tuple', { timeout: 10000 });
    } catch (e) {
      console.error(`Failed to load or parse page ${pageNo}: ${e.message}`);
      await context.close();
      continue;
    }

    const jobs = await page.evaluate(() => {
      const jobItems = [];
      const jobNodes = document.querySelectorAll('.ng-box.srp-tuple');
      jobNodes.forEach(item => {
        // Title and link
        const titleEl = item.querySelector('.designation-title');
        const title = titleEl ? titleEl.innerText.trim() : '';
        const linkEl = item.querySelector('a.info-position');
        let link = linkEl ? linkEl.getAttribute('href') : '';
        if (link && !link.startsWith('http')) {
          link = 'https://www.naukrigulf.com' + link;
        }

        // Company
        const companyEl = item.querySelector('a.info-org');
        const company = companyEl ? companyEl.innerText.trim() : '';

        // Location
        const locEl = item.querySelector('.info-loc span:last-child');
        const location = locEl ? locEl.innerText.trim() : '';

        // Description
        const descEl = item.querySelector('.description');
        const description = descEl ? descEl.innerText.trim() : '';

        // Posting time
        const timeEl = item.querySelector('.time-star-cont .time');
        const postingTime = timeEl ? timeEl.innerText.trim() : '';

        jobItems.push({
          title,
          company,
          location,
          description,
          postingTime,
          link
        });
      });
      return jobItems;
    });

    // Filter jobs by time using the new parser
    const filteredJobs = jobs.filter(job => isWithinTimeframe(job.postingTime, time));

    allJobs = allJobs.concat(filteredJobs);
    console.log(`Page ${pageNo}: Collected ${filteredJobs.length} jobs after filtering`);

    await context.close();
    await new Promise(r => setTimeout(r, randomDelay(2000, 5000)));
  }

  await browser.close();
  return allJobs;
}
