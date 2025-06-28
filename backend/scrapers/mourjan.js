const { chromium } = require('playwright');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

const CATEGORIES = [
  "secreterial", "accounting", "sales-and-marketing", "tourist-and-restaurants", "designer", "teaching",
  "differ-jobs", "engineering", "programming", "fine-arts", "beauty-care", "drivers", "labors", "technicians",
  "medicine-and-nursing", "law", "human-resources", "partnership", "web-designers", "information-technology",
  "customer-service", "translators", "fitness", "landscaping", "fashion", "editorial", "administration",
  "public-relations", "ticketing", "guards", "housemaids", "cleaning-workers", "child-care", "delivery",
  "audio-visual", "ac-technicians", "tailors", "construction", "employee", "data-entry", "craftsmen"
];

function randomDelay(min = 2000, max = 6000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to parse relative time strings like "21 hours ago", "3 days ago"
function parseRelativeTime(str) {
  if (!str) return null;
  const now = new Date();
  const regex = /(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/i;
  const match = str.match(regex);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'minute':
      return new Date(now.getTime() - value * 60 * 1000);
    case 'hour':
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'day':
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case 'week':
      return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.setMonth(now.getMonth() - value));
    case 'year':
      return new Date(now.setFullYear(now.getFullYear() - value));
    default:
      return null;
  }
}

// Helper to check if a date is within the time filter
function isWithinTimeframe(postingTimeStr, time) {
  if (!time) return true;
  const postDate = parseRelativeTime(postingTimeStr);
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
  const browser = await chromium.launch({ headless: true });
  let allJobs = [];

  for (const category of CATEGORIES) {
    for (let pageNo = 1; pageNo <= 1; pageNo++) { // Increase pageNo if you want more pages per category
      const url = `https://www.mourjan.com/sa/${category}/vacancies/en/${pageNo}/`;

      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const context = await browser.newContext({
        userAgent,
        locale: 'en-US'
      });
      const page = await context.newPage();

      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(randomDelay(2000, 5000));
        await page.waitForSelector('.ad', { timeout: 10000 });
      } catch (e) {
        console.error(`Failed to load or parse page ${pageNo} for category ${category}: ${e.message}`);
        await context.close();
        continue;
      }

      const jobs = await page.evaluate((category) => {
        const jobItems = [];
        const ads = document.querySelectorAll('.ad');
        ads.forEach(ad => {
          const linkEl = ad.querySelector('a.link');
          const link = linkEl ? 'https://www.mourjan.com' + linkEl.getAttribute('href') : '';

          const contentEl = ad.querySelector('.content');
          const description = contentEl ? contentEl.innerText.trim() : '';

          // Title: first sentence or up to first period, or first 50 chars as fallback
          let title = '';
          if (description) {
            const match = description.match(/^.*?[.!\n]/);
            title = match ? match[0].trim() : description.slice(0, 50);
          }

          // Posting time: last div inside .box.hint
          let postingTime = '';
          const hintBox = ad.querySelector('.box.hint');
          if (hintBox) {
            const hintDivs = hintBox.querySelectorAll('div');
            if (hintDivs.length > 1) {
              postingTime = hintDivs[hintDivs.length - 1].innerText.trim();
            }
          }

          jobItems.push({
            title,
            postingTime,
            description,
            link,
            category
          });
        });
        return jobItems;
      }, category); // Pass category as argument here

      // Filter jobs by time using the parsed postingTime
      const filteredJobs = jobs.filter(job => isWithinTimeframe(job.postingTime, time));

      allJobs = allJobs.concat(filteredJobs);
      console.log(`Category ${category} Page ${pageNo}: Collected ${filteredJobs.length} jobs after filtering`);

      await context.close();
      await new Promise(r => setTimeout(r, randomDelay(2000, 5000)));
    }
  }

  await browser.close();
  return allJobs;
}
