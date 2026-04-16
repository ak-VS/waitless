import { redirect } from 'next/navigation';
import { query } from '@/db';

export default async function QRRouter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const result = await query(
      'SELECT id, subscription, opening_time, closing_time, timezone FROM restaurants WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) redirect('/not-found');

    const restaurant = result.rows[0];

    // Check if restaurant is open
    const tz = restaurant.timezone || 'Asia/Kolkata';
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const currentHour = localTime.getHours();
    const currentMinute = localTime.getMinutes();
    const currentMins = currentHour * 60 + currentMinute;

    const [openH, openM] = (restaurant.opening_time || '11:00').split(':').map(Number);
    const [closeH, closeM] = (restaurant.closing_time || '23:00').split(':').map(Number);
    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;

    // Handle past midnight closing (e.g. closes at 02:00)
    const isOpen = closeMins < openMins
      ? (currentMins >= openMins || currentMins < closeMins)
      : (currentMins >= openMins && currentMins < closeMins);

    if (!isOpen) {
      redirect(`/customer/closed?r=${id}`);
    }

    if (restaurant.subscription === 'premium') {
      redirect(`/customer/floor?r=${id}`);
    } else {
      redirect(`/customer/join?r=${id}`);
    }
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_REDIRECT')) throw error;
    console.error('QR Router error:', error);
    redirect('/not-found');
  }
}