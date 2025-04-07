const NETWORK_CONDITIONS = {
    GOOD_STABLE: { bandwidth: 5000, latency: 50, jitter: 10 },
    POOR_STABLE: { bandwidth: 1000, latency: 100, jitter: 20 },
    UNSTABLE: () => ({
        bandwidth: Math.random() * (1000 - 100) + 100,
        latency: Math.random() * (300 - 150) + 150,
        jitter: Math.random() * (100 - 50) + 50
    })
};

const totalPeers = 10;
let peers = [];
let peerElements = [];
let simulationStartTime = Date.now();
let simulationDuration = 10000; 
let csvData = [];
let poorPeersCount = 0; 

function assignNetworkCondition() {
    const rand = Math.random();
    if (rand < 0.33) return NETWORK_CONDITIONS.GOOD_STABLE;
    else if (rand < 0.66) return NETWORK_CONDITIONS.POOR_STABLE;
    else return NETWORK_CONDITIONS.UNSTABLE();
}

function createPeer(index) {
    const condition = assignNetworkCondition();
    const peer = {
        id: index,
        networkCondition: condition,
        bandwidth: condition.bandwidth,
        latency: condition.latency,
        jitter: condition.jitter,
        status: 'active',
        startupDelay: 0,
        p2pContribution: 0
    };
    peers[index] = peer;

    const container = document.createElement('div');
    container.className = 'peer-container';

    const video = document.createElement('video');
    video.id = `video${index}`;
    video.controls = true;
    video.width = 640;
    video.height = 360;
    video.muted = true;
    container.appendChild(video);
    document.body.appendChild(container);

    const player = dashjs.MediaPlayer().create();
    player.initialize(video, 'https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd', true);

    peerElements[index] = { container, video, player };

    // Track if the peer is a poor stable peer
    if (condition.bandwidth === 1000) {
        poorPeersCount++;
    }
}

function removePeer(index) {
    if (peers[index]) {
        peers[index].status = 'inactive';
    }
    const el = peerElements[index];
    if (el && el.container && el.container.parentNode) {
        el.container.parentNode.removeChild(el.container);
        delete peerElements[index];
    }

    // Update poor peer count
    if (peers[index] && peers[index].networkCondition.bandwidth === 1000) {
        poorPeersCount--;
    }
}

function calculateAverageBandwidth() {
    const active = peers.filter(p => p.status === 'active');
    const total = active.reduce((sum, p) => sum + p.bandwidth, 0);
    return active.length ? total / active.length : 0;
}

function calculateP2PContributionRatio(peer) {
    const avg = calculateAverageBandwidth();
    return avg ? peer.bandwidth / avg : 0;
}

function adjustChurnRate(peer) {
    return peer.networkCondition.jitter > 30 ? 0.1 : 0.05;
}

async function measureBandwidth(peer) {
    await new Promise(resolve => setTimeout(resolve, peer.latency));
    const fluctuation = 1 + (Math.random() * peer.jitter / 100);
    const adjusted = peer.bandwidth * fluctuation;
    return adjusted;
}

function collectCSVData(timestamp) {
    peers.forEach(peer => {
        if (peer.status === 'active') {
            const contribution = calculateP2PContributionRatio(peer);
            const networkCondition = getNetworkConditionLabel(peer.networkCondition);

            csvData.push({
                id: peer.id,
                time: timestamp,
                bandwidth: peer.bandwidth.toFixed(2),
                latency: peer.latency,
                jitter: peer.jitter,
                contribution: contribution.toFixed(2),
                networkCondition: networkCondition
            });
        }
    });

    const poorPeerRatio = poorPeersCount / totalPeers;
    console.log(`Poor Stable Peer Ratio: ${poorPeerRatio.toFixed(2)}`);
}

function getNetworkConditionLabel(networkCondition) {
    if (networkCondition.bandwidth === 5000) return 'GOOD_STABLE';
    if (networkCondition.bandwidth === 1000) return 'POOR_STABLE';
    return 'UNSTABLE';
}

function exportCSV() {
    const headers = "Peer ID,Time (ms),Bandwidth (kbps),Latency (ms),Jitter (%),P2P Contribution Ratio,Network Condition\n";
    const rows = csvData.map(d =>
        `${d.id},${d.time},${d.bandwidth},${d.latency},${d.jitter},${d.contribution},${d.networkCondition}`
    );
    const blob = new Blob([headers + rows.join("\n")], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "p2p_simulation.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

for (let i = 0; i < totalPeers; i++) {
    createPeer(i);
}

const interval = setInterval(async () => {
    const now = Date.now();
    const elapsed = now - simulationStartTime;

    for (let i = 0; i < totalPeers; i++) {
        const peer = peers[i];
        if (!peer) continue;

        const churnRate = adjustChurnRate(peer);
        if (Math.random() < churnRate) {
            removePeer(i);
        } else if (peer.status === 'inactive') {
            createPeer(i);
        }

        if (peer.status === 'active') {
            const bw = await measureBandwidth(peer);
            peer.bandwidth = bw;
            peer.p2pContribution = calculateP2PContributionRatio(peer);
        }
    }

    collectCSVData(elapsed);

    if (elapsed >= simulationDuration) {
        clearInterval(interval);
        exportCSV();
        console.log("Simulation complete.");
    }

}, 1000);
