const puppeteer = require('puppeteer');
const fs = require('fs');

async function startPeer(id, url, prioritize = false) {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
        protocolTimeout: 60000 
    });
    const page = await browser.newPage();

    const distance = Math.floor(Math.random() * (500 - 20 + 1)) + 20;
    const client = await page.createCDPSession();
    await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: distance,
        downloadThroughput: 10 * 1024 * 1024 / 8,
        uploadThroughput: 5 * 1024 * 1024 / 8
    });

    await page.goto(url);
    await new Promise(resolve => setTimeout(resolve, 40000)); // Increased delay

    await page.evaluate((prio) => {
        window.enablePrioritization = prio;
    }, prioritize);

    await page.evaluate(() => {
        const video = document.getElementById('videoPlayer');
        video.play().catch(err => console.error('Playback failed:', err));
    });

    console.log(`Peer ${id} started with distance ${distance}ms, prioritization: ${prioritize}`);
    return { browser, page, id, distance };
}

async function collectMetrics(page, peerId) {
    try {
        const metrics = await page.evaluate(() => {
            if (!window.performanceData) return { startupDelay: 0, bufferingEvents: 0, p2pBandwidth: 0, playbackLatency: 0 };
            return {
                startupDelay: performanceData.startupDelays[performanceData.startupDelays.length - 1] || 0,
                bufferingEvents: performanceData.bufferingEvents[performanceData.bufferingEvents.length - 1] || 0,
                p2pBandwidth: performanceData.p2pBandwidths[performanceData.p2pBandwidths.length - 1] || 0,
                playbackLatency: performanceData.playbackLatencies[performanceData.playbackLatencies.length - 1] || 0
            };
        });
        console.log(`Peer ${peerId} - Startup Delay: ${metrics.startupDelay}s, Buffering Events: ${metrics.bufferingEvents}, P2P Bandwidth: ${metrics.p2pBandwidth} KB, Playback Latency: ${metrics.playbackLatency}s`);
        return metrics;
    } catch (error) {
        console.error(`Peer ${peerId} - Failed to collect metrics: ${error.message}`);
        return { startupDelay: 0, bufferingEvents: 0, p2pBandwidth: 0, playbackLatency: 0 };
    }
}

async function simulateChurn(numPeers, churnRate, duration, prioritize) {
    const peers = [];
    const results = { churnRate, prioritize, metrics: [] };

    for (let i = 0; i < numPeers; i++) {
        const peer = await startPeer(i, 'http://localhost:3000', prioritize);
        peers.push(peer);
    }

    const startTime = Date.now();
    const sampleInterval = 2000;

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
            const peer = await startPeer(peers.length, 'http://localhost:3000', prioritize);
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

async function testPeerPrioritization() {
    const churnRate = 0.3;
    const numPeers = 5;
    const duration = 60000;

    console.log('Testing without peer prioritization...');
    const noPrioResult = await simulateChurn(numPeers, churnRate, duration, false);
    fs.writeFileSync('no-prio-results.json', JSON.stringify(noPrioResult, null, 2));

    console.log('Testing with peer prioritization...');
    const prioResult = await simulateChurn(numPeers, churnRate, duration, true);
    fs.writeFileSync('prio-results.json', JSON.stringify(prioResult, null, 2));

    for (const result of [noPrioResult, prioResult]) {
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

        console.log(`Summary for ${result.prioritize ? 'With' : 'Without'} Prioritization (Churn Rate ${churnRate * 100}%):`);
        for (const peerId in peerAverages) {
            const avg = peerAverages[peerId];
            console.log(`  Peer ${peerId} (Distance: ${avg.distance}ms):`);
            console.log(`    Avg Startup Delay: ${(avg.startupDelay / avg.count).toFixed(2)}s`);
            console.log(`    Avg Buffering Events: ${(avg.bufferingEvents / avg.count).toFixed(2)}`);
            console.log(`    Avg P2P Bandwidth: ${(avg.p2pBandwidth / avg.count).toFixed(2)} KB`);
            console.log(`    Avg Playback Latency: ${(avg.playbackLatency / avg.count).toFixed(2)}s`);
        }
    }
}

testPeerPrioritization().catch(console.error);