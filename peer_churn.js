const puppeteer = require('puppeteer');
const fs = require('fs');

async function startPeer(id, url) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    protocolTimeout: 60000 
  });
  const page = await browser.newPage();
  await page.goto(url);
  console.log(`Peer ${id} started`);
  return { browser, page, id };
}

async function collectMetrics(page, peerId) {
  try {
    const metrics = await page.evaluate(() => {
      const startupDelay = performanceData.startupDelays[performanceData.startupDelays.length - 1] || 0;
      const bufferingEvents = performanceData.bufferingEvents[performanceData.bufferingEvents.length - 1] || 0;
      const p2pBandwidth = performanceData.p2pBandwidths[performanceData.p2pBandwidths.length - 1] || 0;
      return { startupDelay, bufferingEvents, p2pBandwidth };
    });
    console.log(`Peer ${peerId} - Startup Delay: ${metrics.startupDelay}s, Buffering Events: ${metrics.bufferingEvents}, P2P Bandwidth: ${metrics.p2pBandwidth} KB`);
    return metrics;
  } catch (error) {
    console.error(`Peer ${peerId} - Failed to collect metrics: ${error.message}`);
    return { startupDelay: 0, bufferingEvents: 0, p2pBandwidth: 0 };
  }
}

async function simulateChurn(numPeers, churnRate, duration) {
  const peers = [];
  const results = { churnRate, metrics: [] };

  for (let i = 0; i < numPeers; i++) {
    const peer = await startPeer(i, 'http://localhost:3000');
    peers.push(peer);
  }

  const startTime = Date.now();
  const sampleInterval = 1000; 

  while (Date.now() - startTime < duration) {
    await new Promise(resolve => setTimeout(resolve, sampleInterval));
    for (let i = peers.length - 1; i >= 0; i--) {
      if (Math.random() < churnRate && peers.length > 1) {
        const { browser, id } = peers.splice(i, 1)[0];
        await browser.close();
        console.log(`Peer ${id} left (churn rate: ${churnRate * 100}%)`);
      }
    }

    while (peers.length < numPeers && Math.random() < churnRate) {
      const peer = await startPeer(peers.length, 'http://localhost:3000');
      peers.push(peer);
      console.log(`Peer ${peer.id} joined (churn rate: ${churnRate * 100}%)`);
    }

    const timestamp = Date.now() - startTime;
    const peerMetrics = await Promise.all(peers.map(peer => collectMetrics(peer.page, peer.id)));
    const metricsEntry = {
      timestamp,
      activePeers: peers.length,
      peers: peerMetrics.map((metrics, idx) => ({
        peerId: peers[idx].id,
        ...metrics
      }))
    };
    results.metrics.push(metricsEntry);
  }

  for (const { browser } of peers) {
    await browser.close();
  }
  return results;
}

async function evaluateChurnRates() {
  const churnRates = [0.1, 0.3, 0.5];
  const numPeers = 5;
  const duration = 30000; 
  const allResults = [];

  for (const churnRate of churnRates) {
    console.log(`Evaluating churn rate: ${churnRate * 100}%`);
    const result = await simulateChurn(numPeers, churnRate, duration);
    allResults.push(result);

    const peerAverages = {};
    result.metrics.forEach(entry => {
      entry.peers.forEach(peer => {
        if (!peerAverages[peer.peerId]) {
          peerAverages[peer.peerId] = { startupDelay: 0, bufferingEvents: 0, p2pBandwidth: 0, count: 0 };
        }
        peerAverages[peer.peerId].startupDelay += peer.startupDelay;
        peerAverages[peer.peerId].bufferingEvents += peer.bufferingEvents;
        peerAverages[peer.peerId].p2pBandwidth += peer.p2pBandwidth;
        peerAverages[peer.peerId].count += 1;
      });
    });

    console.log(`Summary for churn rate ${churnRate * 100}%:`);
    for (const peerId in peerAverages) {
      const avg = peerAverages[peerId];
      console.log(`  Peer ${peerId}:`);
      console.log(`    Avg Startup Delay: ${(avg.startupDelay / avg.count).toFixed(2)}s`);
      console.log(`    Avg Buffering Events: ${(avg.bufferingEvents / avg.count).toFixed(2)}`);
      console.log(`    Avg P2P Bandwidth: ${(avg.p2pBandwidth / avg.count).toFixed(2)} KB`);
    }
  }

  fs.writeFileSync('churn-results.json', JSON.stringify(allResults, null, 2));
}

evaluateChurnRates().catch(console.error);