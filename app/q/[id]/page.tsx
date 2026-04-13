import { redirect } from 'next/navigation';
import { query } from '@/db';

export default async function QRRouter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const result = await query(
      'SELECT id, subscription FROM restaurants WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      redirect('/not-found');
    }

    const restaurant = result.rows[0];

    if (restaurant.subscription === 'premium') {
      redirect(`/customer/floor?r=${id}`);
    } else {
      redirect(`/customer/join?r=${id}`);
    }
  } catch (error: any) {
    // Re-throw Next.js redirects — they use throw internally
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('QR Router error:', error);
    redirect('/not-found');
  }
}