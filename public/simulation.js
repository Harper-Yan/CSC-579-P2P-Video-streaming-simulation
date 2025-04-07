(function () {
    var url = "https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd";
    var socket = io.connect('http://localhost:3000');
    var peerId = null;
    var totalPeers = 3;  
    var alpha = 0.8;  //[0.7 to 1]

    var peersPositions = [];
    for (let i = 0; i < totalPeers; i++) {
        peersPositions.push({
            x: Math.random() * 1000,  
            y: Math.random() * 1000   
        });
    }

    for (let i = 0; i < totalPeers; i++) {
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
                console.log("I am peer with ID: " + peerId);
            }
        });
        socket.on('bandwidthUpdate', function (data) {
            if (data.peerId !== peerId) {
                console.log("Peer " + data.peerId + " sending bandwidth: " + data.bandwidth + " kbps");
                updateBandwidthChart(peerIndex, data.bandwidth);
            }
        });

       
        setInterval(async function () {
            var bandwidth = await measureBandwidth(peerIndex);  
            socket.emit('bandwidthReport', { bandwidth: bandwidth });
            console.log("Peer " + peerId + " sending bandwidth: " + bandwidth + " kbps");
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

                var distance = calculateDistance(peerIndex, 0); 
                var scaledBandwidth = bandwidth / (1 + alpha * distance); 

                console.log(`Peer ${peerIndex} bandwidth (scaled): ${scaledBandwidth.toFixed(2)} Mbps`);

                return scaledBandwidth; 
            } catch (err) {
                console.error('Error measuring bandwidth:', err);
                return 0;
            }
        }

        function calculateDistance(peerIndex1, peerIndex2) {
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
})();
