/* OpenRAG native background runner.
 * Runs only when the OS schedules the task; it is not an always-on daemon.
 * Keep each invocation short and checkpoint work remotely or in native storage.
 */
addEventListener('openragNodeTick', async (resolve, reject, args) => {
  try {
    const endpoint = args && args.endpoint;
    const nodeId = args && args.nodeId;
    if (!endpoint || !nodeId) {
      resolve({ ok: false, reason: 'missing-endpoint-or-node-id' });
      return;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId,
        event: 'background-runner-tick',
        at: new Date().toISOString(),
        runtime: 'capacitor-background-runner',
      }),
    });

    if (!response.ok) throw new Error('Witness HTTP ' + response.status);
    resolve({ ok: true, status: response.status });
  } catch (error) {
    reject(error);
  }
});
