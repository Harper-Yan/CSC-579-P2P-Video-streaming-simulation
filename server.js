const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.post('/save', express.json(), (req, res) => {
  fs.writeFileSync('performance.json', JSON.stringify(req.body));
  res.sendStatus(200);
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));