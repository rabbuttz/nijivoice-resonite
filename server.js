const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto'); // Node.js v14.17.0以降
const app = express();

const NIJIVOICE_API_KEY = process.env.NIJIVOICE_API_KEY;

app.get('/speak', async (req, res) => {
  const actorId = req.query.actor;
  const text = req.query.text;
  const speed = req.query.speed || '1.0'; // デフォルト1.0倍速

  // パラメータチェック
  if (!actorId || !text) {
    return res.status(400).send('actorとtextは必須です。例: /speak?actor=ACTOR_ID&text=こんにちは');
  }

  // speedは数値で、0.4～3.0範囲内であることをチェック
  const speedNum = parseFloat(speed);
  if (isNaN(speedNum) || speedNum < 0.4 || speedNum > 3.0) {
    return res.status(400).send('speedは0.4～3.0の範囲で指定してください');
  }

  try {
    // にじボイスAPIコール
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
          // Acceptは特に指定せず音声データが返ることを期待
        }
      }
    );

    const wavBuffer = Buffer.from(response.data);

    // wavファイルを/tmpディレクトリに保存
    const filename = `${randomUUID()}.wav`;
    const filepath = path.join('/tmp', filename);

    fs.writeFile(filepath, wavBuffer, (err) => {
      if (err) {
        console.error('Error writing wav file:', err);
        return res.status(500).send('ファイル書き込みに失敗しました');
      }

      const protocol = req.protocol;
      const host = req.get('host');

      const fileURL = `${protocol}://${host}/files/${filename}`;

      // ファイルURLをJSONで返す
      res.json({ url: fileURL });
    });

  } catch (error) {
    console.error('音声生成に失敗:', error.response ? error.response.data : error.message);
    return res.status(500).send('音声生成に失敗しました');
  }
});

app.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join('/tmp', filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).send('ファイルが見つかりません');
  }

  // wavファイルとしてレスポンス
  res.setHeader('Content-Type', 'audio/wav');
  fs.createReadStream(filepath).pipe(res);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
