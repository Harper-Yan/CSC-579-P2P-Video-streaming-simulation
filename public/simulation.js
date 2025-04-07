const socket = io.connect('http://localhost:3000');

const NETWORK_CONDITIONS = {
    GOOD_STABLE: {
        bandwidth: 5000,
        latency: 50,
        jitter: 10
    },
    POOR_STABLE: {
        bandwidth: 1000,
        latency: 100,
        jitter: 20
    },
    UNSTABLE: {
        bandwidth: Math.random() * (1000 - 100) + 100,
        latency: Math.random() * (300 - 150) + 150,
        jitter: Math.random() * (100 - 50) + 50
    }
};

const totalPeers = 10;
let peers = [];
let peerElements = []; // To track the video elements for each peer

function assignNetworkCondition() {
    let condition = Math.random();
    if (condition < 0.33) {
        return NETWORK_CONDITIONS.GOOD_STABLE;
    } else if (condition < 0.66) {
        return NETWORK_CONDITIONS.POOR_STABLE;
    } else {
        return NETWORK_CONDITIONS.UNSTABLE;
    }
}

for (let i = 0; i < totalPeers; i++) {
    let networkCondition = assignNetworkCondition();
    peers.push({
        id: i,
        networkCondition: networkCondition,
        bandwidth: networkCondition.bandwidth,
        latency: networkCondition.latency,
        jitter: networkCondition.jitter,
        status: 'active'
    });
    console.log(`Peer ${i} assigned network condition:`, networkCondition);
}

function createPeerElement(peerIndex) {
    const peerContainer = document.createElement('div');
    peerContainer.classList.add('peer-container');
    document.body.appendChild(peerContainer);

    const videoElement = document.createElement('video');
    videoElement.id = `videoPlayer${peerIndex}`;
    videoElement.controls = true;
    videoElement.width = 640;
    videoElement.height = 360;
    peerContainer.appendChild(videoElement);

    const player = dashjs.MediaPlayer().create();
    const videoUrl = 'https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd';
    player.initialize(videoElement, videoUrl, true);

    peerElements[peerIndex] = { videoElement, player, peerContainer };
}

function removePeerElement(peerIndex) {
    const peer = peerElements[peerIndex];
    if (peer) {
        peer.peerContainer.removeChild(peer.videoElement);
        peer.peerContainer.removeChild(peer.peerContainer);
        delete peerElements[peerIndex];
    }
}

async function measureBandwidth(peerIndex) {
    const peer = peers[peerIndex];
    const latency = peer.latency;
    const jitter = peer.jitter;

    await new Promise(resolve => setTimeout(resolve, latency));

    const adjustedBandwidth = peer.bandwidth * (1 + (Math.random() * jitter / 100));
    console.log(`Peer ${peerIndex} has adjusted bandwidth: ${adjustedBandwidth} kbps due to jitter`);
    return adjustedBandwidth;
}

function adjustChurnRate(peerIndex) {
    const peer = peers[peerIndex];
    if (peer.networkCondition === NETWORK_CONDITIONS.UNSTABLE) {
        return 0.1;
    }
    return 0.05;
}

setInterval(function () {
    for (let i = 0; i < totalPeers; i++) {
        let randomChance = Math.random();
        let adjustedChurnRate = adjustChurnRate(i);
        if (randomChance < adjustedChurnRate) {
            if (peers[i].status === 'active') {
                console.log(`Peer ${i} has left.`);
                peers[i].status = 'inactive';
                removePeerElement(i); // Remove peer element when it leaves
            } else {
                console.log(`Peer ${i} has joined.`);
                peers[i].status = 'active';
                createPeerElement(i); // Add peer element when it joins
            }
        }
    }
}, 1000);

setInterval(async function () {
    for (let peerIndex = 0; peerIndex < totalPeers; peerIndex++) {
        if (peers[peerIndex].status === 'active') {
            var bandwidth = await measureBandwidth(peerIndex);
            socket.emit('bandwidthReport', { peerId: peerIndex, bandwidth: bandwidth });
        }
    }
}, 1000);

function simulate() {
    setInterval(async function () {
        for (let peerIndex = 0; peerIndex < totalPeers; peerIndex++) {
            if (peers[peerIndex].status === 'active') {
                var bandwidth = await measureBandwidth(peerIndex);
                console.log(`Updated bandwidth for Peer ${peerIndex}: ${bandwidth}`);
            }
        }
    }, 1000);
}

simulate();
