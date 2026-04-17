export async function predictWaitTime(params: {
  party_size: number;
  tables_occupied: number;
  tables_total: number;
  queue_length: number;
  avg_party_size_ahead?: number;
}): Promise<{ minutes: number; confidence: string; factors: any }> {
  try {
    const ML_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

const res = await fetch(`${ML_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        party_size: params.party_size,
        tables_occupied: params.tables_occupied,
        tables_total: params.tables_total,
        queue_length: params.queue_length,
        avg_party_size_ahead: params.avg_party_size_ahead || 2.5,
      })
    });

    if (!res.ok) throw new Error(`ML service error: ${res.status}`);
    const data = await res.json();
    console.log('ML prediction success:', data);
    return {
      minutes: data.predicted_wait_minutes,
      confidence: data.confidence,
      factors: data.factors
    };

  } catch (error: any) {
    console.error('ML prediction failed:', error.message);
    const base = Math.max(5, params.queue_length * 8);
    return {
      minutes: base,
      confidence: 'low',
      factors: {}
    };
  }
}