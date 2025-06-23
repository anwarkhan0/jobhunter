const { chromium } = require('playwright');

const USER_AGENTS = [
  // Add more user agents as needed
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

function randomDelay(min = 2000, max = 6000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = async () => {
  const browser = await chromium.launch({ headless: true });
  let allJobs = [];

  for (let pageNo = 1; pageNo <= 50; pageNo++) {
    const url = `https://www.expatriates.com/scripts/search/search.epl?page=${pageNo}&q=&category_id=50&region_name=Saudi+Arabia&region_id=49&ads=1`;

    // Set a random user agent for each request
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const context = await browser.newContext({
      userAgent,
      locale: 'en-US'
    });
    const page = await context.newPage();

    // Set some common headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(randomDelay(2000, 5000));
      await page.waitForSelector('.search-item', { timeout: 10000 });
    } catch (e) {
      console.error(`Failed to load or parse page ${pageNo}: ${e.message}`);
      await context.close();
      continue;
    }

    const jobs = await page.evaluate(() => {
      const jobItems = [];
      const searchItems = document.querySelectorAll('.search-item');
      searchItems.forEach(item => {
        const titleElement = item.querySelector('span a');
        const descriptionAnchor = item.querySelector('a.user-content');
        const descriptionDiv = descriptionAnchor ? descriptionAnchor.querySelector('div') : null;
        const linkElement = titleElement ? titleElement.getAttribute('href') : '';
        const epoch = item.getAttribute('epoch');
        const postTime = epoch ? new Date(parseInt(epoch) * 1000).toLocaleString() : '';

        jobItems.push({
          title: titleElement ? titleElement.innerText.trim() : 'No Title',
          description: descriptionDiv ? descriptionDiv.innerText.trim() : 'No Description',
          link: linkElement ? 'https://www.expatriates.com' + linkElement : 'No Link',
          postTime: postTime
        });
      });
      return jobItems;
    });

    allJobs = allJobs.concat(jobs);
    console.log(`Page ${pageNo}: Collected ${jobs.length} jobs`);

    await context.close();
    await new Promise(r => setTimeout(r, randomDelay(2000, 5000)));
  }

  await browser.close();
  return allJobs;
}
