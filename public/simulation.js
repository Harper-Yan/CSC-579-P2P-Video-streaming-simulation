(function () {
    var url = "https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd";
    var socket = io.connect('http://localhost:3000');
    var peerId = null;
    var totalPeers = 3;
    var churnRate = 0.5;
    var maxPeers = 6;
    var alpha = 0.2;
    var peersPositions = [];
    var peers = [];

    for (let i = 0; i < totalPeers; i++) {
        addPeer(i);
        createPeer(i);
    }

    function createPeer(peerIndex) {
        var peerContainer = document.getElementById("peerContainer");
        var videoElement = document.createElement('video');
        videoElement.id = `videoPlayer${peerIndex}`;
        videoElement.controls = true;
        peerContainer.appendChild(videoElement);

        var chartContainer = document.createElement('div');
        chartContainer.classList.add('chart-container');
        var canvasElement = document.createElement('canvas');
        canvasElement.id = `chart${peerIndex}`;
        chartContainer.appendChild(canvasElement);
        peerContainer.appendChild(chartContainer);

        var player = dashjs.MediaPlayer().create();

        player.updateSettings({
            streaming: {
                abr: {
                    rules: {
                        throughputRule: {
                            active: true
                        },
                        bolaRule: {
                            active: false
                        },
                        insufficientBufferRule: {
                            active: true
                        },
                        switchHistoryRule: {
                            active: false
                        },
                        droppedFramesRule: {
                            active: false
                        },
                        abandonRequestsRule: {
                            active: false
                        }
                    }
                }
            }
        });

        player.initialize(videoElement, url, true);

        var chart = new Chart(canvasElement, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: `Bandwidth (Peer ${peerIndex})`,
                    data: [],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: false,
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4
                }]
            },
            options: {
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom'
                    },
                    y: {
                        beginAtZero: true,
                        suggestedMin: 0,
                        suggestedMax: 20,
                        title: {
                            display: true,
                            text: 'Bandwidth (Mbps)'
                        },
                        ticks: {
                            autoSkip: true,
                            maxTicksLimit: 10,
                            callback: function(value) {
                                return value.toFixed(2);
                            }
                        }
                    }
                },
                responsive: true,
                maintainAspectRatio: false,
                elements: {
                    line: {
                        tension: 0.4
                    }
                }
            }
        });

        videoElement.chart = chart;
        videoElement.bandwidthData = [];

        socket.on('peerId', function (id) {
            if (!peerId) {
                peerId = id;
            }
        });

        socket.on('bandwidthUpdate', function (data) {
            if (data.peerId !== peerId) {
                updateBandwidthChart(peerIndex, data.bandwidth);
            }
        });

        setInterval(async function () {
            var bandwidth = await measureBandwidth(peerIndex);
            socket.emit('bandwidthReport', { bandwidth: bandwidth });
            updateBandwidthChart(peerIndex, bandwidth);
        }, 5000);

        async function measureBandwidth(peerIndex) {
            var startTime = performance.now();

            try {
                const response = await fetch(url);
                const blob = await response.blob();

                var endTime = performance.now();
                var duration = (endTime - startTime) / 1000;
                var fileSize = blob.size / 1024 / 1024;
                var bandwidth = (fileSize / duration) * 8;

                var distance = calculateDistance(peerIndex, 0);  // Calculate distance from peer 0
                var scaledBandwidth = bandwidth / (1 + alpha * distance);

                return scaledBandwidth;
            } catch (err) {
                console.error('Error measuring bandwidth:', err);
                return 0;
            }
        }

        function calculateDistance(peerIndex1, peerIndex2) {
            // Ensure both peer positions exist
            if (!peersPositions[peerIndex1] || !peersPositions[peerIndex2]) {
                console.error(`Position for peerIndex ${peerIndex1} or ${peerIndex2} is undefined.`);
                return 0;
            }

            var x1 = peersPositions[peerIndex1].x;
            var y1 = peersPositions[peerIndex1].y;
            var x2 = peersPositions[peerIndex2].x;
            var y2 = peersPositions[peerIndex2].y;

            return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        }

        function updateBandwidthChart(peerIndex, bandwidth) {
            var videoElement = document.getElementById(`videoPlayer${peerIndex}`);
            var chart = videoElement.chart;
            var time = Date.now();

            chart.data.labels.push(time);
            chart.data.datasets[0].data.push(bandwidth);

            if (chart.data.labels.length > 10) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }

            chart.update();
        }
    }

    setInterval(function () {
        if (Math.random() < churnRate) {
            if (peers.length < maxPeers && Math.random() < 0.5) {
                var newPeerIndex = peers.length;
                addPeer(newPeerIndex);
                createPeer(newPeerIndex);
                console.log(`Peer ${newPeerIndex} has joined.`);
            } else if (peers.length > 0 && Math.random() < 0.5) {
                var peerIndexToRemove = peers.length - 1;
                removePeer(peerIndexToRemove);
                console.log(`Peer ${peerIndexToRemove} has departed.`);
            }
        }
    }, 2000);

    function addPeer(peerIndex) {
        peers.push(peerIndex);
        peersPositions.push({
            x: Math.random() * 1000,
            y: Math.random() * 1000
        });
    }

    function removePeer(peerIndex) {
        peers.splice(peerIndex, 1);
        peersPositions.splice(peerIndex, 1);
    }

})();
