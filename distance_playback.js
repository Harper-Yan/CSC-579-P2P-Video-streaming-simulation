const puppeteer = require('puppeteer');
const fs = require('fs');

async function startPeer(id, url) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
    protocolTimeout: 60000 
  });
  const page = await browser.newPage();

  // Simulate peer distance as network latency (20ms to 500ms)
  const distance = Math.floor(Math.random() * (500 - 20 + 1)) + 20; // Random latency in ms
  const client = await page.createCDPSession();
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: distance,
    downloadThroughput: 5 * 1024 * 1024 / 8, // 5 Mbps
    uploadThroughput: 2 * 1024 * 1024 / 8     // 2 Mbps
  });

  await page.goto(url);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page load
  console.log(`Peer ${id} started with distance ${distance}ms`);
  
  // Force video playback
  await page.evaluate(() => {
    const video = document.getElementById('videoPlayer');
    video.play().catch(err => console.error('Playback failed:', err));
  });

  return { browser, page, id, distance };
}

async function collectMetrics(page, peerId) {
  try {
    const metrics = await page.evaluate(() => {
      if (!window.performanceData) {
        console.log('performanceData not defined');
        return { startupDelay: 0, bufferingEvents: 0, p2pBandwidth: 0, playbackLatency: 0 };
      }
      const startupDelay = performanceData.startupDelays[performanceData.startupDelays.length - 1] || 0;
      const bufferingEvents = performanceData.bufferingEvents[performanceData.bufferingEvents.length - 1] || 0;
      const p2pBandwidth = performanceData.p2pBandwidths[performanceData.p2pBandwidths.length - 1] || 0;
      const playbackLatency = performanceData.playbackLatencies[performanceData.playbackLatencies.length - 1] || 0;
      return { startupDelay, bufferingEvents, p2pBandwidth, playbackLatency };
    });
    if (metrics.startupDelay !== 0 || metrics.bufferingEvents !== 0 || metrics.p2pBandwidth !== 0 || metrics.playbackLatency !== 0) {
      console.log(`Peer ${peerId} - Startup Delay: ${metrics.startupDelay}s, Buffering Events: ${metrics.bufferingEvents}, P2P Bandwidth: ${metrics.p2pBandwidth} KB, Playback Latency: ${metrics.playbackLatency}s`);
    }
    return metrics;
  } catch (error) {
    console.error(`Peer ${peerId} - Failed to collect metrics: ${error.message}`);
    return { startupDelay: 0, bufferingEvents: 0, p2pBandwidth: 0, playbackLatency: 0 };
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
  const sampleInterval = 1000; // 1 second sampling

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
        distance: peers[idx].distance,
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
  const churnRates = [0.3];
  const numPeers = 5;
  const duration = 30000; // 30 seconds
  const allResults = [];

  for (const churnRate of churnRates) {
    console.log(`Evaluating churn rate: ${churnRate * 100}%`);
    const result = await simulateChurn(numPeers, churnRate, duration);
    allResults.push(result);

    const peerAverages = {};
    result.metrics.forEach(entry => {
      entry.peers.forEach(peer => {
        if (!peerAverages[peer.peerId]) {
          peerAverages[peer.peerId] = { 
            startupDelay: 0, 
            bufferingEvents: 0, 
            p2pBandwidth: 0, 
            playbackLatency: 0, 
            distance: peer.distance, 
            count: 0 
          };
        }
        peerAverages[peer.peerId].startupDelay += peer.startupDelay;
        peerAverages[peer.peerId].bufferingEvents += peer.bufferingEvents;
        peerAverages[peer.peerId].p2pBandwidth += peer.p2pBandwidth;
        peerAverages[peer.peerId].playbackLatency += peer.playbackLatency;
        peerAverages[peer.peerId].count += 1;
      });
    });

    console.log(`Summary for churn rate ${churnRate * 100}%:`);
    for (const peerId in peerAverages) {
      const avg = peerAverages[peer.peerId];
      console.log(`  Peer ${peerId} (Distance: ${avg.distance}ms):`);
      console.log(`    Avg Startup Delay: ${(avg.startupDelay / avg.count).toFixed(2)}s`);
      console.log(`    Avg Buffering Events: ${(avg.bufferingEvents / avg.count).toFixed(2)}`);
      console.log(`    Avg P2P Bandwidth: ${(avg.p2pBandwidth / avg.count).toFixed(2)} KB`);
      console.log(`    Avg Playback Latency: ${(avg.playbackLatency / avg.count).toFixed(2)}s`);
    }
  }

  fs.writeFileSync('churn-results.json', JSON.stringify(allResults, null, 2));
}

evaluateChurnRates().catch(console.error);