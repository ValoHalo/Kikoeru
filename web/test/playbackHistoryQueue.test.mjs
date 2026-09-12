import assert from 'node:assert/strict';
import test from 'node:test';

test('clearing waits for pending history saves and a failed save does not block clearing', async () => {
    const { savePlaybackHistory, clearPlaybackHistory } = await import('../src/utils/playbackHistory.mjs');
    const events = [];
    let finishSave;
    const axios = {
        put: () => { events.push('save'); return new Promise(resolve => { finishSave = resolve; }); },
        delete: () => { events.push('clear'); return Promise.resolve(); },
    };
    const save = savePlaybackHistory(axios, {});
    const clear = clearPlaybackHistory(axios);
    await Promise.resolve();
    assert.deepEqual(events, ['save']);
    finishSave();
    await Promise.all([save, clear]);
    assert.deepEqual(events, ['save', 'clear']);
    axios.put = () => Promise.reject(new Error('offline'));
    await assert.rejects(savePlaybackHistory(axios, {}), /offline/);
    await clearPlaybackHistory(axios);
    assert.deepEqual(events, ['save', 'clear', 'clear']);
});
