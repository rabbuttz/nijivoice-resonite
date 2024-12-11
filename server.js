const express = require('express');
const axios = require('axios');

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
    
    // formatを"wav"または"mp3"など仕様に合わせて変更可能
    const response = await axios.post(
      `https://api.nijivoice.com/api/platform/v1/voice-actors/${encodeURIComponent(actorId)}/generate-voice`,
      {
        script: text,
        speed: speedNum.toString(),
        format: "wav"
      },
      {
        headers: {
          'x-api-key': NIJIVOICE_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(`nijivoice API responded in ${elapsed}ms with status ${response.status}`);
    console.log('Response headers:', response.headers);

    // response.dataはJSON想定
    console.log('Full response data:', response.data);

    // JSONレスポンスから音声URLを抽出
    // 以下はJSON構造が { "generatedVoice": { "audioFileUrl": "https://...." } } という想定
    const audioFileUrl = response.data.generatedVoice?.audioFileUrl;
    if (!audioFileUrl) {
      console.error('audioFileUrl not found in response');
      return res.status(500).send('audioFileUrlがレスポンスから取得できませんでした');
    }

    console.log(`Returning audio file URL: ${audioFileUrl}`);
    res.json({ url: audioFileUrl });

  } catch (error) {
    console.error('Error during nijivoice API call:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data (first 200 chars):', error.response.data ? error.response.data.toString().slice(0, 200) : '');
    } else {
      console.error('Message:', error.message);
    }
    return res.status(500).send('音声生成に失敗しました');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
