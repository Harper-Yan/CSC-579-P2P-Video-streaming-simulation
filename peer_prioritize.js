async function startPeer(id, url) {
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
      downloadThroughput: 5 * 1024 * 1024 / 8,
      uploadThroughput: 2 * 1024 * 1024 / 8
    });
  
    await page.goto(url);
    await new Promise(resolve => setTimeout(resolve, 2000));
  
    await page.evaluate((dist) => {
      window.setPeerDistance(dist);
    }, distance);
  
    await page.evaluate(() => {
      const video = document.getElementById('videoPlayer');
      video.play().catch(err => console.error('Playback failed:', err));
    });
  
    console.log(`Peer ${id} started with distance ${distance}ms`);
    return { browser, page, id, distance };
  }