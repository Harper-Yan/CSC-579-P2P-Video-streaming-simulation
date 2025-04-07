document.addEventListener('DOMContentLoaded', async () => {
  try {
      if (typeof Chart === 'undefined') {
          throw new Error('Chart.js not loaded.');
      }

      const noPrioResponse = await fetch('/no-prio-results');
      const prioResponse = await fetch('/prio-results');
      if (!noPrioResponse.ok || !prioResponse.ok) throw new Error('Fetch failed');

      const noPrioData = await noPrioResponse.json();
      const prioData = await prioResponse.json();

      console.log('No Prioritization Data:', noPrioData);
      console.log('With Prioritization Data:', prioData);

      const colors = {
          noPrio: 'rgba(230, 126, 34, 0.8)', // Orange
          prio: 'rgba(46, 204, 113, 0.8)'     // Green
      };

      function createComparisonDataset(noPrioData, prioData, metricKey, metricLabel) {
          const noPrioMetrics = noPrioData.metrics.flatMap(m => m.peers);
          const prioMetrics = prioData.metrics.flatMap(m => m.peers);

          const labels = noPrioData.metrics.map(m => m.timestamp / 1000);
          return {
              labels,
              datasets: [
                  {
                      label: `${metricLabel} (No Prioritization)`,
                      data: noPrioMetrics.map(m => m[metricKey] || 0),
                      borderColor: colors.noPrio,
                      fill: false,
                      tension: 0.1
                  },
                  {
                      label: `${metricLabel} (With Prioritization)`,
                      data: prioMetrics.map(m => m[metricKey] || 0),
                      borderColor: colors.prio,
                      fill: false,
                      tension: 0.1
                  }
              ]
          };
      }

      const chartConfigs = [
          { id: 'startupChart', key: 'startupDelay', label: 'Startup Delay', unit: 's', title: 'Startup Delay Comparison' },
          { id: 'bufferingChart', key: 'bufferingEvents', label: 'Buffering Events', unit: '', title: 'Buffering Events Comparison' },
          { id: 'bandwidthChart', key: 'p2pBandwidth', label: 'P2P Bandwidth', unit: 'KB', title: 'P2P Bandwidth Comparison' },
          { id: 'latencyChart', key: 'playbackLatency', label: 'Playback Latency', unit: 's', title: 'Playback Latency Comparison' }
      ];

      chartConfigs.forEach(config => {
          const ctx = document.getElementById(config.id)?.getContext('2d');
          if (!ctx) throw new Error(`${config.label} canvas not found`);

          new Chart(ctx, {
              type: 'line',
              data: createComparisonDataset(noPrioData, prioData, config.key, config.label),
              options: {
                  responsive: true,
                  scales: {
                      x: { title: { display: true, text: 'Time (seconds)' }, ticks: { stepSize: 5 } },
                      y: { title: { display: true, text: `${config.label} (${config.unit})` }, beginAtZero: true }
                  },
                  plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: config.title }
                  }
              }
          });
      });

  } catch (error) {
      console.error('Visualization error:', error.message);
      document.body.innerHTML += `<p style="color: red;">Error: ${error.message}</p>`;
  }
});