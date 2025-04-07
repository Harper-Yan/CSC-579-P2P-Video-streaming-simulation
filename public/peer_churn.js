const NETWORK_CONDITIONS = {
    GOOD_STABLE: { bandwidth: 5000, latency: 50, jitter: 10 },
    POOR_STABLE: { bandwidth: 1000, latency: 100, jitter: 20 },
    UNSTABLE: () => ({
        bandwidth: Math.random() * (1000 - 100) + 100,
        latency: Math.random() * (300 - 150) + 150,
        jitter: Math.random() * (100 - 50) + 50
    })
};

const simulationChurnRates = Array.from({ length: 10 }, (_, i) => 0.05 + (i * 0.05)); 
const totalPeers = 10;
const simulationDuration = 10000;
const peerLifetime = 5000;

let allCsvData = []; // Store one set of data per simulation
let peers = [];

function assignNetworkCondition() {
    const rand = Math.random();
    if (rand < 0.33) return NETWORK_CONDITIONS.GOOD_STABLE;
    else if (rand < 0.66) return NETWORK_CONDITIONS.POOR_STABLE;
    else return NETWORK_CONDITIONS.UNSTABLE();
}

function createPeer(index, churnRate) {
    const condition = assignNetworkCondition();
    const peer = {
        id: index,
        networkCondition: condition,
        bandwidth: condition.bandwidth,
        latency: condition.latency,
        jitter: condition.jitter,
        status: 'active',
        lastActive: Date.now(),
        p2pContribution: 0,
        churnRate: churnRate
    };
    peers[index] = peer;
    console.log(`Created peer ${index} with churn rate: ${peer.churnRate.toFixed(4)}`);
}

function removePeer(index) {
    const peer = peers[index];
    if (peer) {
        peer.status = 'inactive';
        console.log(`Peer ${index} churned out with churn rate: ${peer.churnRate.toFixed(4)}`);
    }
}

function calculateAverageBandwidth() {
    const activePeers = peers.filter(peer => peer.status === 'active');
    const totalBandwidth = activePeers.reduce((sum, peer) => sum + peer.bandwidth, 0);
    return activePeers.length ? totalBandwidth / activePeers.length : 0;
}

function calculateP2PContributionRatio(peer) {
    const avgBandwidth = calculateAverageBandwidth();
    return avgBandwidth ? peer.bandwidth / avgBandwidth : 0;
}

function adjustChurnRate(peer) {
    return peer.churnRate;
}

async function measureBandwidth(peer) {
    await new Promise(resolve => setTimeout(resolve, peer.latency));
    const fluctuation = 1 + (Math.random() * peer.jitter / 100);
    const adjustedBandwidth = peer.bandwidth * fluctuation;
    return adjustedBandwidth;
}

function collectCSVData(timestamp, churnRateIndex) {
    peers.forEach(peer => {
        if (peer.status === 'active') {
            const contribution = calculateP2PContributionRatio(peer);
            allCsvData.push({
                simulation: churnRateIndex,
                id: peer.id,
                time: timestamp,
                bandwidth: peer.bandwidth.toFixed(2),
                latency: peer.latency,
                jitter: peer.jitter,
                contribution: contribution.toFixed(2),
                churnRate: peer.churnRate.toFixed(4)
            });
            console.log(`Collected final data for Peer ${peer.id} at ${timestamp}ms - Bandwidth: ${peer.bandwidth.toFixed(2)}, Churn Rate: ${peer.churnRate.toFixed(4)}`);
        }
    });
    console.log(`Total data points collected so far: ${allCsvData.length}`);
}

function exportCSV() {
    console.log(`Exporting CSV with ${allCsvData.length} data points`);
    const headers = "Simulation,Peer ID,Time (ms),Bandwidth (kbps),Latency (ms),Jitter (%),P2P Contribution Ratio,Churn Rate\n";
    const rows = allCsvData.map(d =>
        `${d.simulation},${d.id},${d.time},${d.bandwidth},${d.latency},${d.jitter},${d.contribution},${d.churnRate}`
    );
    
    if (rows.length === 0) {
        console.error("No data to export!");
    }

    const blob = new Blob([headers + rows.join("\n")], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "p2p_simulation_10_sets_final.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function simulateChurn(churnRate, churnRateIndex) {
    const startTime = Date.now();
    let simulationEndTime = startTime + simulationDuration;

    // Create peers initially with the given churn rate
    peers = [];
    for (let i = 0; i < totalPeers; i++) {
        createPeer(i, churnRate);
    }

    while (Date.now() < simulationEndTime) {
        const elapsed = Date.now() - startTime;
        
        for (let i = 0; i < totalPeers; i++) {
            const peer = peers[i];
            if (!peer) continue;

            const churn = adjustChurnRate(peer);

            if (Math.random() < churn) {
                removePeer(i);
            } else if (peer.status === 'inactive') {
                createPeer(i, churnRate);
                console.log(`Peer ${i} rejoined with churn rate: ${peers[i].churnRate.toFixed(4)}`);
            }

            if (peer.status === 'active') {
                const bandwidth = await measureBandwidth(peer);
                peer.bandwidth = bandwidth;
                peer.p2pContribution = calculateP2PContributionRatio(peer);
            }
        }
        // No data collection here; wait until the end
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Collect data only at the end of the simulation
    collectCSVData(simulationDuration, churnRateIndex);
}

async function runSimulation() {
    allCsvData = [];
    for (let i = 0; i < simulationChurnRates.length; i++) {
        const churnRate = simulationChurnRates[i];
        console.log(`Running simulation ${i + 1}/10 with churn rate: ${churnRate.toFixed(4)}`);
        await simulateChurn(churnRate, i);
    }
    exportCSV();
}

runSimulation();