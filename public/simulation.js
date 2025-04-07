(function () {
  var url = "https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd";
  var socket = io.connect('http://localhost:3000');
  var peerId = null;

  var totalPeers = 5;

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
      player.initialize(videoElement, url, true);

      var chart = new Chart(canvasElement, {
          type: 'line',
          data: {
              labels: [], 
              datasets: [{
                  label: `Bandwidth (Peer ${peerIndex})`,
                  data: [], //Bandwidth
                  borderColor: 'rgba(75, 192, 192, 1)',
                  fill: false
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
                      ticks: {
                          min: 0,
                          max: 10
                      }
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
          console.log("Peer " + peerId + " sending bandwidth: " + bandwidth + " Mbps");
          updateBandwidthChart(peerIndex, bandwidth);
      }, 5000);

      async function measureBandwidth(peerIndex) {
         
          var startTime = performance.now();
          
          //Avoid asyncronization between measure and log;
          try {
              const response = await fetch(url);
              const blob = await response.blob();

              var endTime = performance.now();
              var duration = (endTime - startTime) / 1000; // seconds
              var fileSize = blob.size / 1024 / 1024; //MB
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

          if (chart.data.labels.length > 10) {
              chart.data.labels.shift();
              chart.data.datasets[0].data.shift();
          }

          chart.update();
      }
  }

})();

