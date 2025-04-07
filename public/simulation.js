(function () {
    var url = "https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd";
    var socket = io.connect('http://localhost:3000');
    var peerId = null;
    var totalPeers = 6;  
    var peersWithABR = 3;  

    socket.on('peerId', function (id) {
        if (!peerId) {
            peerId = id;
            console.log("I am peer with ID: " + peerId);
        }
    });
    socket.on('bandwidthUpdate', function (data) {
        if (data.peerId !== peerId) {
            console.log("Peer " + data.peerId + " sending bandwidth: " + data.bandwidth + " kbps");
            updateBandwidthChart(data.peerIndex, data.bandwidth);
        }
    });


    setInterval(async function () {
        var bandwidth = await measureBandwidth(peerId);// or will read undefined values.
        socket.emit('bandwidthReport', { bandwidth: bandwidth, peerId: peerId });
        console.log("Peer " + peerId + " sending bandwidth: " + bandwidth + " kbps");
        updateBandwidthChart(peerId, bandwidth);
    }, 5000);

    async function measureBandwidth(peerIndex) {
        var startTime = performance.now();

        try {
            const response = await fetch(url);
            const blob = await response.blob();

            var endTime = performance.now();d
            var duration = (endTime - startTime) / 1000; 
            var fileSize = blob.size / 1024 / 1024; //mb
            var bandwidth = (fileSize / duration) * 8; 
            console.log(`Peer ${peerIndex} bandwidth: ${bandwidth.toFixed(2)} Mbps`);
            return bandwidth; 
        } catch (err) {
            console.error('Error measuring bandwidth:', err);
            return 0;
        }
    }

    function updateBandwidthChart(peerIndex, bandwidth) {
        var videoElement = document.getElementById(`videoPlayer${peerIndex}`);
        var chart = videoElement.chart;
        var time = Date.now();
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(bandwidth);
        //Move the axis
        if (chart.data.labels.length > 10) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.update();
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
        //Invididual chart
        var chartContainer = document.createElement('div');
        chartContainer.classList.add('chart-container');
        var canvasElement = document.createElement('canvas');
        canvasElement.id = `chart${peerIndex}`;
        chartContainer.appendChild(canvasElement);
        peerContainer.appendChild(chartContainer);
    
        var player = dashjs.MediaPlayer().create();
        if (peerIndex < peersWithABR) {//where abr rules are defined
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
        } else {
            player.updateSettings({
                streaming: {
                    abr: {
                        rules: {
                            throughputRule: {
                                active: false
                            },
                            bolaRule: {
                                active: false
                            },
                            insufficientBufferRule: {
                                active: false
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
        }
    
        player.initialize(videoElement, url, true);
    
        var chart = new Chart(canvasElement, {
            type: 'line',
            data: {
                labels: [], 
                datasets: [{
                    label: `Bandwidth (Peer ${peerIndex})`,
                    data: [], 
                    borderColor: peerIndex < peersWithABR ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)', // Different colors for ABR and non-ABR
                    backgroundColor: peerIndex < peersWithABR ? 'rgba(75, 192, 192, 0.2)' : 'rgba(255, 99, 132, 0.2)', 
                    fill: false, 
                    borderWidth: 2, 
                    pointRadius: 0, 
                    tension: 0.4 
                }]
            },
            options: {//Settings for a nice figure
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
            if (videoElement) {  
                var bandwidth = await measureBandwidth(peerIndex);  //or read undefined values
                socket.emit('bandwidthReport', { bandwidth: bandwidth });
                console.log("Peer " + peerId + " sending bandwidth: " + bandwidth + " kbps");
                updateBandwidthChart(peerIndex, bandwidth);
            }
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
                console.log(`Peer ${peerIndex} bandwidth: ${bandwidth.toFixed(2)} Mbps`);
                return bandwidth; 
            } catch (err) {
                console.error('Error measuring bandwidth:', err);
                return 0;
            }
        }
    
        function updateBandwidthChart(peerIndex, bandwidth) {
            var videoElement = document.getElementById(`videoPlayer${peerIndex}`);
            if (videoElement) {
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
    }    
})();
