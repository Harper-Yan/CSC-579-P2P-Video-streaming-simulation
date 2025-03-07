const puppeteer = require('puppeteer');

async function startPeer(id, url) {
  const browser = await puppeteer.launch({ headless: false , args: ['--no-sandbox', '--disable-setuid-sandbox']}); 
  const page = await browser.newPage();
  await page.goto(url);
  console.log(`Peer ${id} started`);

  return { browser, page };
}

async function simulatePeers(numPeers, baseUrl) {
  const peers = [];
  for (let i = 0; i < numPeers; i++) {
    const peer = await startPeer(i, baseUrl);
    peers.push(peer);
  }

  setInterval(async () => {
    if (Math.random() < 0.2 && peers.length > 1) { 
      const { browser } = peers.pop();
      await browser.close();
      console.log('Peer left');
    }
    if (Math.random() < 0.2 && peers.length < numPeers) { 
      const peer = await startPeer(peers.length, baseUrl);
      peers.push(peer);
      console.log('Peer joined');
    }
  }, 10000); 
}

simulatePeers(5, 'http://localhost:3000');