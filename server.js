const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();

const NIJIVOICE_API_KEY = process.env.NIJIVOICE_API_KEY;

app.get('/speak', async (req, res) => {
  console.log('--- /speak endpoint called ---');
  
  const actorId = req.query.actor;
  const text = req.query.text;
  const speed = req.query.speed || '1.0';

  console.log(`Received parameters: actor=${actorId}, text=${text}, speed=${speed}`);

  if (!actorId || !text) {
    console.log('Missing required parameters: actor or text');
    return res.status(400).send('actorとtextは必須です。例: /speak?actor=ACTOR_ID&text=こんにちは');
  }

  const speedNum = parseFloat(speed);
  if (isNaN(speedNum) || speedNum < 0.4 || speedNum > 3.0) {
    console.log(`Invalid speed value: ${speedNum}`);
    return res.status(400).send('speedは0.4～3.0の範囲で指定してください');
  }

  console.log('Sending request to nijivoice API...');
  try {
    const startTime = Date.now();
    
    // にじボイスAPIにリクエスト
    const response = await axios.post(
      `https://api.nijivoice.com/api/platform/v1/voice-actors/${encodeURIComponent(actorId)}/generate-voice`,
      {
        script: text,
        speed: speedNum.toString(),
        format: "wav"
      },
      {
        responseType: 'arraybuffer',
        headers: {
          'x-api-key': NIJIVOICE_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(`nijivoice API responded in ${elapsed}ms with status ${response.status}`);

    // レスポンスヘッダーや先頭数バイトをログ出力して内容確認
    console.log('Response headers:', response.headers);
    console.log('First 50 bytes of response data:', response.data.slice(0, 50));

    const wavBuffer = Buffer.from(response.data);

    // ファイル書き込み開始
    console.log('Writing wav file to /tmp directory...');
    const filename = `${randomUUID()}.wav`;
    const filepath = path.join('/tmp', filename);

    fs.writeFile(filepath, wavBuffer, (err) => {
      if (err) {
        console.error('Error writing wav file:', err);
        return res.status(500).send('ファイル書き込みに失敗しました');
      }

      console.log(`Successfully wrote wav file: ${filepath}`);

      const protocol = req.protocol;
      const host = req.get('host');

      const fileURL = `${protocol}://${host}/files/${filename}`;
      console.log(`Returning file URL: ${fileURL}`);

      res.json({ url: fileURL });
    });

  } catch (error) {
    console.error('Error during nijivoice API call:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data (first 200 chars):', error.response.data.toString().slice(0, 200));
    } else {
      console.error('Message:', error.message);
    }
    return res.status(500).send('音声生成に失敗しました');
  }
});

app.get('/files/:filename', (req, res) => {
  console.log('--- /files endpoint called ---');
  const filename = req.params.filename;
  console.log(`Requested filename: ${filename}`);

  const filepath = path.join('/tmp', filename);
  if (!fs.existsSync(filepath)) {
    console.log('File does not exist:', filepath);
    return res.status(404).send('ファイルが見つかりません');
  }

  console.log(`Serving file: ${filepath}`);
  res.setHeader('Content-Type', 'audio/wav');
  fs.createReadStream(filepath)
    .on('error', err => {
      console.error('Error reading file:', err);
      res.status(500).send('ファイル読み込みエラー');
    })
    .pipe(res);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
