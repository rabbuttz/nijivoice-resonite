const express = require('express');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpegPath = require('ffmpeg-static'); // ffmpeg-staticを使用

const app = express();

const NIJIVOICE_API_KEY = process.env.NIJIVOICE_API_KEY;

app.get('/speak', async (req, res) => {
  const actorId = req.query.actor;
  const text = req.query.text;

  if (!actorId || !text) {
    return res.status(400).send('actorとtextは必須です。例: /speak?actor=ACTOR_ID&text=こんにちは');
  }

  try {
    const response = await axios.post(
      `https://api.nijivoice.com/api/platform/v1/voice-actors/${encodeURIComponent(actorId)}/generate-voice`,
      {
        script: text,
        speed: "1.0",
        format: "wav"
      },
      {
        responseType: 'arraybuffer',
        headers: {
          'x-api-key': NIJIVOICE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    const wavBuffer = Buffer.from(response.data);

    // ffmpeg-staticのパスを利用
    const ffmpeg = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-f', 'ogg',
      '-acodec', 'libopus',
      'pipe:1'
    ]);

    let oggData = Buffer.alloc(0);

    ffmpeg.stdout.on('data', (chunk) => {
      oggData = Buffer.concat([oggData, chunk]);
    });

    ffmpeg.stderr.on('data', (data) => {
      console.error('ffmpeg stderr:', data.toString());
    });

    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        console.error(`ffmpeg process exited with code ${code}`);
        return res.status(500).send('ffmpeg変換に失敗しました');
      }

      // oggファイルを/tmpディレクトリに保存
      const filename = `${uuidv4()}.ogg`;
      const filepath = path.join('/tmp', filename);

      fs.writeFile(filepath, oggData, (err) => {
        if (err) {
          console.error('Error writing ogg file:', err);
          return res.status(500).send('ファイル書き込みに失敗しました');
        }

        const protocol = req.protocol;
        const host = req.get('host');

        const fileURL = `${protocol}://${host}/files/${filename}`;

        res.json({ url: fileURL });
      });
    });

    ffmpeg.stdin.write(wavBuffer);
    ffmpeg.stdin.end();

  } catch (error) {
    console.error(error);
    return res.status(500).send('音声生成に失敗しました');
  }
});

app.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join('/tmp', filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).send('ファイルが見つかりません');
  }

  res.setHeader('Content-Type', 'audio/ogg');
  fs.createReadStream(filepath).pipe(res);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
