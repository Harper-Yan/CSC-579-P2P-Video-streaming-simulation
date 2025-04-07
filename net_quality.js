const puppeteer = require('puppeteer');
const fs = require('fs');

async function startPeer(id, url, networkCondition) {
    const browser = await puppeteer.launch({
        headless: false, // Use non-headless to allow video playback
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
        protocolTimeout: 60000 
    });
    const page = await browser.newPage();

    // Emulate network conditions
    const client = await page.createCDPSession();
    await client.send('Network.emulateNetworkConditions', networkCondition);

    await page.goto(url);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s

    // Force video playback
    await page.evaluate(() => {
        const video = document.getElementById('videoPlayer');
        video.play().catch(err => console.error('Puppeteer play failed:', err));
    });

    console.log(`Peer ${id} started with ${networkCondition.offline ? 'offline' : `${networkCondition.downloadThroughput / 125000} Mbps down, ${networkCondition.uploadThroughput / 125000} Mbps up, ${networkCondition.latency}ms latency`}`);
    return { browser, page, id };
}

  async function collectMetrics(page, peerId) {
    try {
      await page.waitForSelector('#videoPlayer', { timeout: 10000 });
      const metrics = await page.evaluate(() => {
        if (!window.performanceData) {
          console.log('performanceData not defined yet');
          return { startupDelay: 0, bufferingEvents: 0, p2pBandwidth: 0 };
        }
        console.log('performanceData:', JSON.stringify(window.performanceData));
        const startupDelay = performanceData.startupDelays.length > 0 
          ? performanceData.startupDelays[performanceData.startupDelays.length - 1] 
          : 0;
        const bufferingEvents = performanceData.bufferingEvents.length > 0 
          ? performanceData.bufferingEvents[performanceData.bufferingEvents.length - 1] 
          : 0;
        const p2pBandwidth = performanceData.p2pBandwidths.length > 0 
          ? performanceData.p2pBandwidths[performanceData.p2pBandwidths.length - 1] 
          : 0;
        return { startupDelay, bufferingEvents, p2pBandwidth };
      });
  
      // Only log if at least one metric is non-zero
      if (metrics.startupDelay !== 0 || metrics.bufferingEvents !== 0 || metrics.p2pBandwidth !== 0) {
        console.log(`Peer ${peerId} - Startup Delay: ${metrics.startupDelay}s, Buffering Events: ${metrics.bufferingEvents}, P2P Bandwidth: ${metrics.p2pBandwidth} MB`);
      }
  
      return metrics;
    } catch (error) {
      console.error(`Peer ${peerId} - Failed to collect metrics: ${error.message}`);
      return { startupDelay: 0, bufferingEvents: 0, p2pBandwidth: 0 };
    }
  }

async function simulateChurn(numPeers, churnRate, duration, networkCondition) {
    const peers = [];
    const results = { churnRate, networkCondition, metrics: [] };
  
    for (let i = 0; i < numPeers; i++) {
      const peer = await startPeer(i, 'http://localhost:3000', networkCondition);
      peers.push(peer);
    }
  
    const startTime = Date.now();
    const sampleInterval = 50;
  
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
        const peer = await startPeer(peers.length, 'http://localhost:3000', networkCondition);
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
    const churnRate = 0.3; // Increase to 30% for more churn stress
    const numPeers = 5;
    const duration = 60000; // Increase to 60s for more data points

    const networkConditions = [
        { name: 'Good', offline: false, latency: 20, downloadThroughput: 10 * 1024 * 1024 / 8, uploadThroughput: 5 * 1024 * 1024 / 8 },
        { name: 'Poor', offline: false, latency: 200, downloadThroughput: 1 * 1024 * 1024 / 8, uploadThroughput: 0.5 * 1024 * 1024 / 8 },
        { name: 'Unstable', offline: false, latency: 500, downloadThroughput: 2 * 1024 * 1024 / 8, uploadThroughput: 1 * 1024 * 1024 / 8 }
    ];

    const allResults = [];

    for (const condition of networkConditions) {
        console.log(`Evaluating churn rate: ${churnRate * 100}% with ${condition.name} network`);
        const result = await simulateChurn(numPeers, churnRate, duration, condition);
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

        console.log(`Summary for churn rate ${churnRate * 100}% with ${condition.name} network:`);
        for (const peerId in peerAverages) {
            const avg = peerAverages[peerId];
            console.log(`  Peer ${peerId}:`);
            console.log(`    Avg Startup Delay: ${(avg.startupDelay / avg.count).toFixed(2)}s`);
            console.log(`    Avg Buffering Events: ${(avg.bufferingEvents / avg.count).toFixed(2)}`);
            console.log(`    Avg P2P Bandwidth: ${(avg.p2pBandwidth / avg.count).toFixed(2)} MB`);
        }
    }

    fs.writeFileSync('network-churn-results.json', JSON.stringify(allResults, null, 2));
}

evaluateChurnRates().catch(console.error);
